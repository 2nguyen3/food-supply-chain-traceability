import { expect } from "chai";
import { network } from "hardhat";
import { id as keccakId } from "ethers";

// Việc P03-05, P03-06, P03-07 và test C04–C10 (P03-13), cùng một phần X03, X07, C15 (hết hạn).
// Chỉ dùng ví thử nghiệm có sẵn của Hardhat (trong bộ nhớ), không có khóa thật.
const { ethers, networkHelpers } = await network.create();

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const H_META = keccakId("metadata.json");
const H_CERT = keccakId("certificate.pdf");
const H_IMG = keccakId("batch.jpg");
const H = [H_META, H_CERT, H_IMG];
const WRONG = keccakId("tampered");
const LOCK_EXPIRED = 1n; // enum LockReason { Sold, Expired, Recalled }
const CREATED = 0n;
const IN_TRANSIT = 1n;
const DELIVERED = 2n;

function withWrong(i: number) {
  const h = [...H];
  h[i] = WRONG;
  return h;
}

async function deployFixture() {
  const [admin, farmerA, farmerB, logistics, retailer, stranger] = await ethers.getSigners();
  const contract = await ethers.deployContract("FoodTraceability");
  const FARMER_ROLE = await contract.FARMER_ROLE();
  const LOGISTICS_ROLE = await contract.LOGISTICS_ROLE();
  const RETAILER_ROLE = await contract.RETAILER_ROLE();
  await contract.connect(admin).assignFarmer(farmerA.address, "FARM-A");
  await contract.connect(admin).assignFarmer(farmerB.address, "FARM-B");
  await contract.connect(admin).grantRole(LOGISTICS_ROLE, logistics.address);
  await contract.connect(admin).grantRole(RETAILER_ROLE, retailer.address);
  return { contract, admin, farmerA, farmerB, logistics, retailer, stranger, FARMER_ROLE, LOGISTICS_ROLE, RETAILER_ROLE };
}

// tokenId 1, thuộc farmerA, lifecycle Created
async function createdFixture() {
  const fx = await deployFixture();
  const now = Number(await networkHelpers.time.latest());
  const info = {
    batchCode: "COCONUT-001",
    harvestGroupId: "HG-A01",
    farmLocation: "Ben Tre, Viet Nam",
    quantityKg: 1000n,
    harvestDate: BigInt(now),
    expiryDate: BigInt(now + THIRTY_DAYS),
  };
  await fx.contract.connect(fx.farmerA).createBatch(info, CID, H_META, H_CERT, H_IMG);
  return { ...fx, info };
}

// farmerA đề nghị giao cho logistics: requestId 1
async function requestedFixture() {
  const fx = await createdFixture();
  await fx.contract.connect(fx.farmerA).requestTransfer(1n, fx.logistics.address);
  return fx;
}

// logistics đã nhận: owner logistics, InTransit
async function inTransitFixture() {
  const fx = await requestedFixture();
  await fx.contract.connect(fx.logistics).acceptTransfer(1n, 1n, H);
  return fx;
}

// logistics đề nghị giao cho retailer: requestId 2
async function requested2Fixture() {
  const fx = await inTransitFixture();
  await fx.contract.connect(fx.logistics).requestTransfer(1n, fx.retailer.address);
  return fx;
}

// retailer đã nhận: owner retailer, Delivered
async function deliveredFixture() {
  const fx = await requested2Fixture();
  await fx.contract.connect(fx.retailer).acceptTransfer(1n, 2n, H);
  return fx;
}

async function expectNoChange(fx: Awaited<ReturnType<typeof requestedFixture>>, owner: string, lifecycle: bigint, requestId: bigint) {
  expect(await fx.contract.ownerOf(1n)).to.equal(owner);
  expect((await fx.contract.getBatch(1n)).lifecycle).to.equal(lifecycle);
  const p = await fx.contract.getPendingTransfer(1n);
  expect(p.active).to.equal(true);
  expect(p.requestId).to.equal(requestId);
}

describe("P03-05: hàm đọc getBatch, getPendingTransfer, isExpired", function () {
  it("tokenId không tồn tại (0 và 999) thì revert BatchNotFound", async function () {
    const { contract } = await networkHelpers.loadFixture(createdFixture);
    for (const t of [0n, 999n]) {
      await expect(contract.getBatch(t)).to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
      await expect(contract.getPendingTransfer(t)).to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
      await expect(contract.isExpired(t)).to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
    }
  });

  it("lô mới chưa có yêu cầu: getPendingTransfer không active; chưa hết hạn", async function () {
    const { contract } = await networkHelpers.loadFixture(createdFixture);
    const p = await contract.getPendingTransfer(1n);
    expect(p.active).to.equal(false);
    expect(p.requestId).to.equal(0n);
    expect(await contract.isExpired(1n)).to.equal(false);
  });

  it("isExpired chuyển thành true sau expiryDate mà lifecycle gốc không đổi", async function () {
    const { contract, info } = await networkHelpers.loadFixture(createdFixture);
    await networkHelpers.time.increaseTo(Number(info.expiryDate) + 1);
    expect(await contract.isExpired(1n)).to.equal(true);
    expect((await contract.getBatch(1n)).lifecycle).to.equal(CREATED);
  });
});

describe("C04: request bàn giao hợp lệ", function () {
  it("tạo yêu cầu chờ; owner và lifecycle chưa đổi; không có event Transfer", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(createdFixture);
    const tx = contract.connect(farmerA).requestTransfer(1n, logistics.address);
    await expect(tx).to.emit(contract, "TransferRequested").withArgs(1n, farmerA.address, logistics.address, 1n);
    await expect(tx).to.not.emit(contract, "Transfer");

    const p = await contract.getPendingTransfer(1n);
    expect(p.requestId).to.equal(1n);
    expect(p.tokenId).to.equal(1n);
    expect(p.from).to.equal(farmerA.address);
    expect(p.to).to.equal(logistics.address);
    expect(p.active).to.equal(true);
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
    expect((await contract.getBatch(1n)).lifecycle).to.equal(CREATED);
  });
});

describe("C05: request sai người, sai tuyến hoặc đã có yêu cầu chờ", function () {
  it("không phải chủ lô bị chặn (NotTokenOwner)", async function () {
    const { contract, stranger, logistics, retailer } = await networkHelpers.loadFixture(createdFixture);
    await expect(contract.connect(stranger).requestTransfer(1n, logistics.address))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, stranger.address);
    await expect(contract.connect(logistics).requestTransfer(1n, retailer.address))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, logistics.address);
    expect((await contract.getPendingTransfer(1n)).active).to.equal(false);
  });

  it("nhảy tuyến Farmer → Retailer bị chặn (InvalidRoute)", async function () {
    const { contract, farmerA, retailer } = await networkHelpers.loadFixture(createdFixture);
    await expect(contract.connect(farmerA).requestTransfer(1n, retailer.address))
      .to.be.revertedWithCustomError(contract, "InvalidRoute")
      .withArgs(farmerA.address, retailer.address);
  });

  it("đã có yêu cầu chờ thì request thứ hai bị chặn (PendingExists), yêu cầu đầu giữ nguyên", async function () {
    const fx = await networkHelpers.loadFixture(requestedFixture);
    const { contract, farmerA, logistics } = fx;
    await expect(contract.connect(farmerA).requestTransfer(1n, logistics.address))
      .to.be.revertedWithCustomError(contract, "PendingExists")
      .withArgs(1n, 1n);
    await expectNoChange(fx, farmerA.address, CREATED, 1n);
  });
});

describe("C06: nhận đúng 3 hash thì bàn giao thành công", function () {
  it("Farmer → Logistics: đổi chủ, lifecycle InTransit, phát TransferAccepted và Transfer", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    const tx = contract.connect(logistics).acceptTransfer(1n, 1n, H);
    await expect(tx)
      .to.emit(contract, "TransferAccepted")
      .withArgs(1n, farmerA.address, logistics.address, 1n, H_META, H_CERT, H_IMG);
    await expect(tx).to.emit(contract, "Transfer").withArgs(farmerA.address, logistics.address, 1n);
    expect(await contract.ownerOf(1n)).to.equal(logistics.address);
    expect((await contract.getBatch(1n)).lifecycle).to.equal(IN_TRANSIT);
    expect((await contract.getPendingTransfer(1n)).active).to.equal(false);
  });

  it("Logistics → Retailer: đổi chủ, lifecycle Delivered", async function () {
    const { contract, logistics, retailer } = await networkHelpers.loadFixture(requested2Fixture);
    const tx = contract.connect(retailer).acceptTransfer(1n, 2n, H);
    await expect(tx)
      .to.emit(contract, "TransferAccepted")
      .withArgs(1n, logistics.address, retailer.address, 2n, H_META, H_CERT, H_IMG);
    await expect(tx).to.emit(contract, "Transfer").withArgs(logistics.address, retailer.address, 1n);
    expect(await contract.ownerOf(1n)).to.equal(retailer.address);
    expect((await contract.getBatch(1n)).lifecycle).to.equal(DELIVERED);
    expect((await contract.getPendingTransfer(1n)).active).to.equal(false);
  });
});

describe("C07: sai một trong 3 hash thì revert nguyên giao dịch", function () {
  const names = ["metadata", "certificate", "image"];
  for (const i of [0, 1, 2]) {
    it(`Farmer → Logistics: sai hash ${names[i]} (HashMismatch(${i}))`, async function () {
      const fx = await networkHelpers.loadFixture(requestedFixture);
      await expect(fx.contract.connect(fx.logistics).acceptTransfer(1n, 1n, withWrong(i)))
        .to.be.revertedWithCustomError(fx.contract, "HashMismatch")
        .withArgs(BigInt(i));
      await expectNoChange(fx, fx.farmerA.address, CREATED, 1n);
      await expect(fx.contract.connect(fx.logistics).acceptTransfer(1n, 1n, H)).to.emit(fx.contract, "TransferAccepted");
    });

    it(`Logistics → Retailer: sai hash ${names[i]} (HashMismatch(${i}))`, async function () {
      const fx = await networkHelpers.loadFixture(requested2Fixture);
      await expect(fx.contract.connect(fx.retailer).acceptTransfer(1n, 2n, withWrong(i)))
        .to.be.revertedWithCustomError(fx.contract, "HashMismatch")
        .withArgs(BigInt(i));
      await expectNoChange(fx, fx.logistics.address, IN_TRANSIT, 2n);
    });
  }
});

describe("C08: nhận bằng yêu cầu cũ hoặc đã đóng", function () {
  it("yêu cầu đã bị hủy thì không nhận được (NoActiveRequest)", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    await contract.connect(farmerA).cancelTransfer(1n, 1n);
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "NoActiveRequest")
      .withArgs(1n);
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
  });

  it("nhận bằng requestId cũ khi đã có yêu cầu mới (StaleRequest)", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    await contract.connect(farmerA).cancelTransfer(1n, 1n);
    await contract.connect(farmerA).requestTransfer(1n, logistics.address); // requestId 2
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "StaleRequest")
      .withArgs(1n, 2n);
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
    await expect(contract.connect(logistics).acceptTransfer(1n, 2n, H)).to.emit(contract, "TransferAccepted");
  });

  it("yêu cầu đã được nhận rồi thì nhận lần hai bị chặn (NoActiveRequest)", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "NoActiveRequest")
      .withArgs(1n);
    expect(await contract.ownerOf(1n)).to.equal(logistics.address);
  });
});

describe("C09: reject và cancel đúng quyền", function () {
  it("sai người bị chặn: reject chỉ cho người nhận (NotRecipient), cancel chỉ cho người gửi (NotSender)", async function () {
    const fx = await networkHelpers.loadFixture(requestedFixture);
    const { contract, farmerA, logistics, stranger } = fx;
    for (const caller of [stranger, farmerA]) {
      await expect(contract.connect(caller).rejectTransfer(1n, 1n))
        .to.be.revertedWithCustomError(contract, "NotRecipient")
        .withArgs(caller.address, logistics.address);
    }
    for (const caller of [stranger, logistics]) {
      await expect(contract.connect(caller).cancelTransfer(1n, 1n))
        .to.be.revertedWithCustomError(contract, "NotSender")
        .withArgs(caller.address, farmerA.address);
    }
    await expectNoChange(fx, farmerA.address, CREATED, 1n);
  });

  it("người nhận reject: đóng yêu cầu, owner không đổi, phát TransferRejected", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    await expect(contract.connect(logistics).rejectTransfer(1n, 1n))
      .to.emit(contract, "TransferRejected")
      .withArgs(1n, 1n, logistics.address);
    expect((await contract.getPendingTransfer(1n)).active).to.equal(false);
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
  });

  it("người gửi cancel: đóng yêu cầu rồi tạo được yêu cầu mới", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    await expect(contract.connect(farmerA).cancelTransfer(1n, 1n))
      .to.emit(contract, "TransferCancelled")
      .withArgs(1n, 1n, farmerA.address);
    expect((await contract.getPendingTransfer(1n)).active).to.equal(false);
    await expect(contract.connect(farmerA).requestTransfer(1n, logistics.address))
      .to.emit(contract, "TransferRequested")
      .withArgs(1n, farmerA.address, logistics.address, 2n);
  });
});

describe("C10: vai trò bị thu hồi giữa request và accept", function () {
  it("người nhận (Logistics) mất vai trò thì không nhận được", async function () {
    const fx = await networkHelpers.loadFixture(requestedFixture);
    const { contract, admin, logistics, LOGISTICS_ROLE } = fx;
    await contract.connect(admin).revokeRole(LOGISTICS_ROLE, logistics.address);
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "RoleNoLongerValid")
      .withArgs(logistics.address, LOGISTICS_ROLE);
    await expectNoChange(fx, fx.farmerA.address, CREATED, 1n);
  });

  it("người gửi (Farmer) mất vai trò thì cũng không bàn giao được", async function () {
    const fx = await networkHelpers.loadFixture(requestedFixture);
    const { contract, admin, farmerA, logistics, FARMER_ROLE } = fx;
    await contract.connect(admin).revokeRole(FARMER_ROLE, farmerA.address);
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "RoleNoLongerValid")
      .withArgs(farmerA.address, FARMER_ROLE);
    await expectNoChange(fx, farmerA.address, CREATED, 1n);
  });

  it("chặng Logistics → Retailer: Retailer mất vai trò thì không nhận được", async function () {
    const fx = await networkHelpers.loadFixture(requested2Fixture);
    const { contract, admin, retailer, RETAILER_ROLE } = fx;
    await contract.connect(admin).revokeRole(RETAILER_ROLE, retailer.address);
    await expect(contract.connect(retailer).acceptTransfer(1n, 2n, H))
      .to.be.revertedWithCustomError(contract, "RoleNoLongerValid")
      .withArgs(retailer.address, RETAILER_ROLE);
    await expectNoChange(fx, fx.logistics.address, IN_TRANSIT, 2n);
  });
});

describe("X03: tuyến bàn giao sai", function () {
  it("Farmer → người không có vai trò, hoặc Farmer → Farmer, đều bị chặn", async function () {
    const { contract, farmerA, farmerB, stranger } = await networkHelpers.loadFixture(createdFixture);
    for (const to of [stranger, farmerB]) {
      await expect(contract.connect(farmerA).requestTransfer(1n, to.address))
        .to.be.revertedWithCustomError(contract, "InvalidRoute")
        .withArgs(farmerA.address, to.address);
    }
  });

  it("Logistics giao ngược về Farmer bị chặn", async function () {
    const { contract, logistics, farmerA } = await networkHelpers.loadFixture(inTransitFixture);
    await expect(contract.connect(logistics).requestTransfer(1n, farmerA.address))
      .to.be.revertedWithCustomError(contract, "InvalidRoute")
      .withArgs(logistics.address, farmerA.address);
  });

  it("đã Delivered thì không còn tuyến nào nữa", async function () {
    const { contract, retailer, logistics } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(contract.connect(retailer).requestTransfer(1n, logistics.address))
      .to.be.revertedWithCustomError(contract, "InvalidRoute")
      .withArgs(retailer.address, logistics.address);
  });
});

describe("X07: tokenId không tồn tại trong các hàm bàn giao", function () {
  it("request, accept, reject, cancel với tokenId 0 và 999 đều revert BatchNotFound", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(requestedFixture);
    for (const t of [0n, 999n]) {
      await expect(contract.connect(farmerA).requestTransfer(t, logistics.address))
        .to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
      await expect(contract.connect(logistics).acceptTransfer(t, 1n, H))
        .to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
      await expect(contract.connect(logistics).rejectTransfer(t, 1n))
        .to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
      await expect(contract.connect(farmerA).cancelTransfer(t, 1n))
        .to.be.revertedWithCustomError(contract, "BatchNotFound").withArgs(t);
    }
  });
});

describe("C15 (phần hết hạn): lô hết hạn không bàn giao được", function () {
  it("request trên lô đã hết hạn bị chặn (BatchLocked, Expired)", async function () {
    const { contract, farmerA, logistics, info } = await networkHelpers.loadFixture(createdFixture);
    await networkHelpers.time.increaseTo(Number(info.expiryDate) + 1);
    await expect(contract.connect(farmerA).requestTransfer(1n, logistics.address))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_EXPIRED);
  });

  it("accept trên lô đã hết hạn bị chặn; owner và lifecycle gốc giữ nguyên", async function () {
    const { contract, farmerA, logistics, info } = await networkHelpers.loadFixture(requestedFixture);
    await networkHelpers.time.increaseTo(Number(info.expiryDate) + 1);
    await expect(contract.connect(logistics).acceptTransfer(1n, 1n, H))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_EXPIRED);
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
    expect((await contract.getBatch(1n)).lifecycle).to.equal(CREATED);
  });

  it("reject và cancel vẫn dùng được sau khi lô hết hạn", async function () {
    const a = await networkHelpers.loadFixture(requestedFixture);
    await networkHelpers.time.increaseTo(Number(a.info.expiryDate) + 1);
    await expect(a.contract.connect(a.logistics).rejectTransfer(1n, 1n)).to.emit(a.contract, "TransferRejected");
    expect((await a.contract.getPendingTransfer(1n)).active).to.equal(false);
  });

  it("cancel vẫn dùng được sau khi lô hết hạn", async function () {
    const a = await networkHelpers.loadFixture(requestedFixture);
    await networkHelpers.time.increaseTo(Number(a.info.expiryDate) + 1);
    await expect(a.contract.connect(a.farmerA).cancelTransfer(1n, 1n)).to.emit(a.contract, "TransferCancelled");
    expect((await a.contract.getPendingTransfer(1n)).active).to.equal(false);
  });
});
