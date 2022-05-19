const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("English Auction", function () {
  let [admin, seller1, seller2, bidder1, bidder2, bidder3] = []
  let englishAuction  
  let gold
  let petty
  let startingPrice = 1000
  let oneDay = 86400  
  let address0 = "0x0000000000000000000000000000000000000000"
  beforeEach(async () => {
    [admin, seller1, seller2, bidder1, bidder2, bidder3] = await ethers.getSigners()

    const Gold = await ethers.getContractFactory("Gold")
    gold = await Gold.deploy()
    await gold.deployed()

    const Petty = await ethers.getContractFactory("Petty")
    petty = await Petty.deploy()
    await petty.deployed()

    const EnglishAuction = await ethers.getContractFactory("EnglishAuction")
    englishAuction = await EnglishAuction.deploy(petty.address, gold.address)
    await petty.deployed()

    gold.transfer(seller1.address, 10000)
    gold.transfer(seller2.address, 10000)
    gold.transfer(bidder1.address, 10000)
    gold.transfer(bidder2.address, 10000)
    gold.transfer(bidder3.address, 10000)
    gold.connect(bidder1).approve(englishAuction.address, 10000)
    gold.connect(bidder2).approve(englishAuction.address, 10000)
    gold.connect(bidder3).approve(englishAuction.address, 10000)
    petty.mint(seller1.address)
    petty.mint(seller2.address)
    petty.connect(seller1).approve(englishAuction.address, 1)
    petty.connect(seller2).approve(englishAuction.address, 2)
  })

  describe("start bid", function () {
    it("should revert if the caller does not own nft", async function () {
      await expect(englishAuction.connect(seller1).startBid(2, oneDay, startingPrice))
      .to.be.revertedWith("EA: You are not the owner of this NFT")
    });  
    it("should start bid correctly", async function () {
      const bidInfo1 = await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)
      expect (await petty.ownerOf(1)).to.be.equal(englishAuction.address)
      const blockNum1 = await ethers.provider.getBlockNumber()
      const block1 = await ethers.provider.getBlock(blockNum1)
      await expect(bidInfo1).to.be.emit(englishAuction, "Start").withArgs(
      1, 1, seller1.address, block1.timestamp, oneDay)

      const bidInfo2 = await englishAuction.connect(seller2).startBid(2, oneDay, startingPrice)
      expect (await petty.ownerOf(2)).to.be.equal(englishAuction.address)
      const blockNum2 = await ethers.provider.getBlockNumber()
      const block2 = await ethers.provider.getBlock(blockNum2)
      await expect(bidInfo2).to.be.emit(englishAuction, "Start").withArgs(
      2, 2, seller2.address, block2.timestamp, oneDay)        
    });   
  })

  describe("cancel bid", function () {
    it("should revert if bidId does not exist", async function () {
      await expect(englishAuction.connect(seller1).cancelBid(1))
      .to.be.revertedWith("EA: The bid does not exist")
    });  
    it("should revert if the caller is not the seller", async function () {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)
      await expect(englishAuction.connect(seller2).cancelBid(1))
      .to.be.revertedWith("EA: Not seller")
    });
    it("should revert if someone joined the bid", async function () {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)      
      await englishAuction.connect(bidder1).bid(1, 1500)
      await expect(englishAuction.connect(seller1).cancelBid(1))
      .to.be.revertedWith("EA: Someone already joined the bid")
    }); 
    it("should revert if the bid is aldready ended", async function () {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)    
      await network.provider.send("evm_increaseTime", [oneDay + 1])
      await network.provider.send('evm_mine', [])
      await englishAuction.connect(seller1).endBid(1)
      await expect(englishAuction.connect(seller1).cancelBid(1))
      .to.be.revertedWith("EA: The bid is already ended")      
    });
    it("should cancel bid correctly", async function () {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)
      const cancelBidTx = await englishAuction.connect(seller1).cancelBid(1)        
      const bidInfo = await englishAuction.bids(1)    
      expect (bidInfo.isEnd).to.be.equal(true)
      await (expect(cancelBidTx)).to.be.emit(englishAuction, "Cancel").withArgs(1)
    });    
  })
  
  describe("bid", function () {
    beforeEach(async () => {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)
    }); 
    it("should revert if bidId does not exist", async function () {
      await expect(englishAuction.connect(bidder1).bid(2, 1500))
      .to.be.revertedWith("EA: The bid does not exist")
    });      
    it("should revert if the bid is ended", async function () {
      await englishAuction.connect(seller1).cancelBid(1)
      await expect(englishAuction.connect(bidder1).bid(1, 1500))
      .to.be.revertedWith("EA: The bid already ended")
    });
    it("should revert if amount is less than hightestBid", async function () {      
      await expect(englishAuction.connect(bidder1).bid(1, 900))
      .to.be.revertedWith("EA: Not reach hightestBid")
      await englishAuction.connect(bidder1).bid(1, 1500)
      await expect(englishAuction.connect(bidder2).bid(1, 1300))
      .to.be.revertedWith("EA: Not reach hightestBid")
    });
    it("should revert if time out", async function () {  
      await network.provider.send("evm_increaseTime", [oneDay + 1])
      await network.provider.send('evm_mine', [])    
      await expect(englishAuction.connect(bidder1).bid(1, 1500))
      .to.be.revertedWith("EA: Time out")
    });
    it("should bid correctly", async function () {          
      const bidTx1 = await englishAuction.connect(bidder1).bid(1, 1500)      
      const blockNum1 = await ethers.provider.getBlockNumber()
      const block1 = await ethers.provider.getBlock(blockNum1)
      await (expect(bidTx1)).to.be.emit(englishAuction, "Bid").withArgs(1, bidder1.address, 1500, block1.timestamp)
      expect(await englishAuction.highestBid(1)).to.be.equal(1500)
      expect(await englishAuction.highestBidder(1)).to.be.equal(bidder1.address)
      expect(await gold.balanceOf(bidder1.address)).to.be.equal(10000-1500)
      expect(await gold.balanceOf(englishAuction.address)).to.be.equal(1500)
      expect(await englishAuction.refunds(1, address0)).to.be.equal(0)

      const bidTx2 = await englishAuction.connect(bidder2).bid(1, 2000)      
      const blockNum2 = await ethers.provider.getBlockNumber()
      const block2 = await ethers.provider.getBlock(blockNum2)
      await (expect(bidTx2)).to.be.emit(englishAuction, "Bid").withArgs(1, bidder2.address, 2000, block2.timestamp)
      expect(await englishAuction.highestBid(1)).to.be.equal(2000)
      expect(await englishAuction.highestBidder(1)).to.be.equal(bidder2.address)
      expect(await gold.balanceOf(bidder2.address)).to.be.equal(10000-2000)
      expect(await gold.balanceOf(englishAuction.address)).to.be.equal(1500+2000)
      expect(await englishAuction.refunds(1, bidder1.address)).to.be.equal(1500)

      const bidTx3 = await englishAuction.connect(bidder3).bid(1, 2500)      
      const blockNum3 = await ethers.provider.getBlockNumber()
      const block3 = await ethers.provider.getBlock(blockNum3)
      await (expect(bidTx3)).to.be.emit(englishAuction, "Bid").withArgs(1, bidder3.address, 2500, block3.timestamp)
      expect(await englishAuction.highestBid(1)).to.be.equal(2500)
      expect(await englishAuction.highestBidder(1)).to.be.equal(bidder3.address)
      expect(await gold.balanceOf(bidder3.address)).to.be.equal(10000-2500)
      expect(await gold.balanceOf(englishAuction.address)).to.be.equal(1500+2000+2500)
      expect(await englishAuction.refunds(1, bidder1.address)).to.be.equal(1500)
      expect(await englishAuction.refunds(1, bidder2.address)).to.be.equal(2000)
    });    
  })

  describe("end bid", function () {
    beforeEach(async () => {
      await englishAuction.connect(seller1).startBid(1, oneDay, startingPrice)
    }); 
    it("should revert if it does not reach time point", async function () {   
      await expect(englishAuction.endBid(1)).to.be.revertedWith("EA: Not reach end time")   
    });      
    it("should revert if the bid is canceled", async function () {   
      await englishAuction.connect(seller1).cancelBid(1)
      await network.provider.send("evm_increaseTime", [oneDay + 1])
      await network.provider.send('evm_mine', []) 
      await expect(englishAuction.endBid(1)).to.be.revertedWith("EA: The bid already ended")   
    });    
    it("should end bit correctly when someone joins the bid", async function () { 
      await englishAuction.connect(bidder1).bid(1, 1500)
      await englishAuction.connect(bidder2).bid(1, 2000)
      await englishAuction.connect(bidder3).bid(1, 2500)
      await network.provider.send("evm_increaseTime", [oneDay + 1])
      await network.provider.send('evm_mine', [])      

      const endBidTx = englishAuction.endBid(1)
      await expect(endBidTx).to.be.emit(englishAuction, "End").withArgs(1, bidder3.address, 2500)
      expect(await petty.ownerOf(1)).to.be.equal(bidder3.address)
      expect(await gold.balanceOf(seller1.address)).to.be.equal(10000 + 2500)  
      const bidTx = await englishAuction.bids(1)
      expect(bidTx.isEnd).to.be.equal(true)         
    });

    it("should end bit correctly when no one joins the bid", async function () {       
      await network.provider.send("evm_increaseTime", [oneDay + 1])
      await network.provider.send('evm_mine', [])      

      const endBidTx = englishAuction.endBid(1)
      await expect(endBidTx).to.be.emit(englishAuction, "End").withArgs(1, address0, 1000)
      expect(await petty.ownerOf(1)).to.be.equal(seller1.address)        
      const bidTx = await englishAuction.bids(1)
      expect(bidTx.isEnd).to.be.equal(true)         
    });
  })
})
