const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployMultiSigWalletFixture() {
    const minApprovals = 2;

    // Contracts are deployed using the first signer/account by default
    const [owner1, owner2, owner3] = await ethers.getSigners();

    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    const multiSigWallet = await MultiSigWallet.deploy([owner1, owner2, owner3], minApprovals);

    const contractAddress = await multiSigWallet.getAddress();

    return { multiSigWallet, minApprovals, owner1, owner2, owner3, contractAddress };
  }

  describe("Deployment", function () {
    it("Should deploy contract", async function () {
      await loadFixture(deployMultiSigWalletFixture);
    });
  });

  describe("Multiple signature", function () {
    describe("Validations", function () {
      it("Should fail to submit transaction", async function () {
        const { multiSigWallet, contractAddress, } = await loadFixture(deployMultiSigWalletFixture);
        const [_1, _2, _3, notOwner] = await ethers.getSigners();

        await expect(multiSigWallet.connect(notOwner).submit(contractAddress, 1, ethers.randomBytes(32))).to.be.revertedWith(
          "Unauthorized: not owner"
        );
      });

      it("Should fail to approve transaction", async function () {
        const { multiSigWallet } = await loadFixture(deployMultiSigWalletFixture);
        const [_1, _2, _3, notOwner] = await ethers.getSigners();

        await expect(multiSigWallet.connect(notOwner).approve(0)).to.be.revertedWith(
          "Unauthorized: not owner"
        );
      });

      it("Should fail to revoke transaction", async function () {
        const { multiSigWallet } = await loadFixture(deployMultiSigWalletFixture);
        const [_1, _2, _3, notOwner] = await ethers.getSigners();

        await expect(multiSigWallet.connect(notOwner).revoke(0)).to.be.revertedWith(
          "Unauthorized: not owner"
        );
      });

      it("Should fail to execute transaction", async function () {
        const { multiSigWallet } = await loadFixture(deployMultiSigWalletFixture);
        const [_1, _2, _3, notOwner] = await ethers.getSigners();

        await expect(multiSigWallet.connect(notOwner).execute(0)).to.be.revertedWith(
          "tx does not exists"
        );
      });
    });

    describe("Simulation", function () {
      it("Should submit a transaction", async function () {
        const { multiSigWallet, owner1, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        await expect(multiSigWallet.connect(owner1).submit(contractAddress, 1, ethers.randomBytes(32)))
          .to.emit(multiSigWallet, "Submit").withArgs(0);
      });

      it("Should submit multiple transactions", async function () {
        const { multiSigWallet, owner1, owner2, owner3, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        await expect(multiSigWallet.connect(owner1).submit(contractAddress, 1, ethers.randomBytes(32)))
          .to.emit(multiSigWallet, "Submit").withArgs(0);

        await expect(multiSigWallet.connect(owner2).submit(contractAddress, 1, ethers.randomBytes(32)))
          .to.emit(multiSigWallet, "Submit").withArgs(1);

        await expect(multiSigWallet.connect(owner3).submit(contractAddress, 1, ethers.randomBytes(32)))
        .to.emit(multiSigWallet, "Submit").withArgs(2);

      });

      it("Should submit and approve transaction", async function () {
        const { multiSigWallet, owner1, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        // submit transaction
        multiSigWallet.connect(owner1).submit(contractAddress, 1, ethers.randomBytes(32));

        // get transaction index
        const index = await multiSigWallet.getTransactionIndex();

        await expect(multiSigWallet.connect(owner1).approve(index)).to.emit(multiSigWallet, "Approve").withArgs(owner1.address, index);
      });

      it("Should submit transaction, approve transaction and revoke transaction", async function () {
        const { multiSigWallet, owner1, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        // submit transaction
        multiSigWallet.connect(owner1).submit(contractAddress, 1, ethers.randomBytes(32));

        // get transaction index
        const index = await multiSigWallet.getTransactionIndex();

        // approve transaction
        await multiSigWallet.connect(owner1).approve(index)
      
        // revoke approval
        await expect(multiSigWallet.connect(owner1).revoke(index)).to.emit(multiSigWallet, "Revoke").withArgs(owner1.address, index);
      });

      it("Should submit transaction and multiple approval on transaction", async function () {
        const { multiSigWallet, owner1, owner2, owner3, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        // submit transaction
        multiSigWallet.connect(owner1).submit(contractAddress, ethers.parseEther("0.001"), ethers.toUtf8Bytes("blob"));

        // get transaction index
        const index = await multiSigWallet.getTransactionIndex();

        await expect(multiSigWallet.connect(owner1).approve(index)).to.emit(multiSigWallet, "Approve").withArgs(owner1.address, index);
        await expect(multiSigWallet.connect(owner2).approve(index)).to.emit(multiSigWallet, "Approve").withArgs(owner2.address, index);
        await expect(multiSigWallet.connect(owner3).approve(index)).to.emit(multiSigWallet, "Approve").withArgs(owner3.address, index);
      });

      it("Should submit multiple approval and execute transaction", async function () {
        const { multiSigWallet, owner1, owner2, owner3, contractAddress } = await loadFixture(deployMultiSigWalletFixture);

        // submit transaction
        multiSigWallet.connect(owner1).submit(ethers.getAddress(contractAddress), ethers.parseEther("0.1"), ethers.randomBytes(32));

        // get transaction index
        const index = await multiSigWallet.getTransactionIndex();

        // approve transaction
        await multiSigWallet.connect(owner1).approve(index);
        await multiSigWallet.connect(owner2).approve(index);
        await multiSigWallet.connect(owner3).approve(index);

        // execute transaction
        // await expect(multiSigWallet.connect(owner3).execute(index)).to.be.revertedWith(
        //   "tx failed"
        // );
        await expect(multiSigWallet.connect(owner3).execute(index)).to.emit(multiSigWallet, "Execute").withArgs(0);
      });
    });
  });
});
