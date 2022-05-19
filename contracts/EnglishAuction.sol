//SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract EnglishAuction is Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _bidIdCount;
    event Start(
        uint indexed bidId, 
        uint indexed nftId, 
        address indexed seller, 
        uint startTime, 
        uint duration
    );

    event Cancel(
        uint indexed bidId
    );

    event Bid(
        uint indexed bidId,
        address indexed bidder,
        uint bidAmount,
        uint time
    );

    event End(
        uint indexed bidId,
        address indexed highestBidder,
        uint highestBid
    );

    event ClaimRefund(
        uint indexed bidId,
        address indexed Bidder,
        uint RefundAmount 
    );

    IERC721 public immutable nft;
    IERC20 public immutable token;
    constructor(address _nftContract, address _tokenContract) {
        nft = IERC721(_nftContract);
        token = IERC20(_tokenContract);
    }

    struct BidInfo {
        uint nftId;
        address seller;
        uint startingPrice;
        uint startTime;
        uint duration;        
        bool isEnd;
    }          
    mapping(uint => BidInfo) public bids;
    mapping(uint => address) public highestBidder;
    mapping(uint => uint) public highestBid;
    mapping(uint => mapping(address => uint)) public refunds;

    function startBid(uint _nftId, uint _bidTime, uint _startingPrice) external {        
        require(nft.ownerOf(_nftId) == msg.sender, "EA: You are not the owner of this NFT");        
        
        nft.transferFrom(_msgSender(), address(this), _nftId);        
        _bidIdCount.increment();
        uint _bidId = _bidIdCount.current();
        highestBid[_bidId] = _startingPrice;
        BidInfo storage bid = bids[_bidId];
        bid.nftId = _nftId;
        bid.seller = _msgSender();
        bid.startingPrice = _startingPrice;
        bid.startTime = block.timestamp;
        bid.duration = _bidTime;
        bid.isEnd = false;

        emit Start(_bidId, bid.nftId, bid.seller, bid.startTime, bid.duration);
    }

    function cancelBid(uint _bidId) external {
        BidInfo storage bid = bids[_bidId];
        require(_bidId <= _bidIdCount.current(), "EA: The bid does not exist");
        require(bid.seller == _msgSender(), "EA: Not seller");
        require(bid.isEnd == false, "EA: The bid is already ended");
        require(highestBidder[_bidId] == address(0), "EA: Someone already joined the bid");

        bid.isEnd = true;

        emit Cancel(_bidId);
    }

    function bid(uint _bidId, uint _amount) external {
        BidInfo storage bid = bids[_bidId];
        require(_bidId <= _bidIdCount.current(), "EA: The bid does not exist");
        require(bid.isEnd == false, "EA: The bid already ended");
        require(_amount > highestBid[_bidId], "EA: Not reach hightestBid");
        require(block.timestamp < bid.startTime + bid.duration, "EA: Time out");

        token.transferFrom(_msgSender(), address(this), _amount);
        if(highestBidder[_bidId] != address(0)) {
            address outBidder = highestBidder[_bidId];            
            refunds[_bidId][outBidder] += highestBid[_bidId];
        }
        highestBidder[_bidId] = _msgSender();
        highestBid[_bidId] = _amount;

        emit Bid(_bidId, _msgSender(), _amount, block.timestamp);        
    }

    function endBid(uint _bidId) external {
        BidInfo storage bid = bids[_bidId];        
        require(block.timestamp > bid.startTime + bid.duration, "EA: Not reach end time");
        require(bid.isEnd == false, "EA: The bid already ended");

        bid.isEnd = true;       
        if(highestBidder[_bidId] == address(0)) {
            nft.transferFrom(address(this), bid.seller, bid.nftId);
        } else {
            nft.transferFrom(address(this), highestBidder[_bidId], bid.nftId);
            token.transfer(bid.seller, highestBid[_bidId]);
        }

        emit End(_bidId, highestBidder[_bidId], highestBid[_bidId]);
    }

    function claimRefund(uint _bidId) external {        
        require(_bidId <= _bidIdCount.current(), "EA: The bid does not exist");

        uint refundAmount = refunds[_bidId][_msgSender()];
        refunds[_bidId][_msgSender()] = 0;
        token.transfer(_msgSender(), refundAmount);

        emit ClaimRefund(_bidId, _msgSender(), refundAmount);
    }
}
