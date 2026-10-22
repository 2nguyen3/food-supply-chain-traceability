import { expect } from "chai";
import { network } from "hardhat";
import { id as keccakId } from "ethers";

// Việc P03-08, P03-09, P03-10, P03-11 và test C11–C18, X01, X02, X04, X06, X07, X08, C15 (phần còn lại).
// Chỉ dùng ví thử nghiệm có sẵn của Hardhat (trong bộ nhớ), không có khóa thật.
const { ethers, networkHelpers } = await network.create();

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
const H_META = keccakId("metadata.json");
const H_CERT = keccakId("certificate.pdf");
const H_IMG = keccakId("batch.jpg");
const H = [H_META, H_CERT, H_IMG];
const REPORT_CID = "bafkreireportreportreportreportreportreportreportreportreport1";
const REPORT_HASH = keccakId("incident-report.pdf");
const REASON_CID = "bafkreireasonreasonreasonreasonreasonreasonreasonreasonreason1";
const REASON_HASH = keccakId("recall-reason.pdf");
const LOC = "10.77,106.70";
const LOCK_SOLD = 0n;
const LOCK_EXPIRED = 1n;
const LOCK_RECALLED = 2n;
const CREATED = 0n;
const IN_TRANSIT = 1n;
const SOLD = 3n;

async function deployFixture() {
  const [admin, farmerA, farmerB, logistics, retailer, stranger] = await ethers.getSigners();
  const contract = await ethers.deployContract("FoodTraceability");
  const LOGISTICS_ROLE = await contract.LOGISTICS_ROLE();
  const RETAILER_ROLE = await contract.RETAILER_ROLE();
  await contract.connect(admin).assignFarmer(farmerA.address, "FARM-A");
  await contract.connect(admin).assignFarmer(farmerB.address, "FARM-B");
  await contract.connect(admin).grantRole(LOGISTICS_ROLE, logistics.address);
  await contract.connect(admin).grantRole(RETAILER_ROLE, retailer.address);
  return { contract, admin, farmerA, farmerB, logistics, retailer, stranger, LOGISTICS_ROLE, RETAILER_ROLE };
}

type Fx = Awaited<ReturnType<typeof deployFixture>>;

async function newInfo(code: string, group = "HG-A01") {
  const now = Number(await networkHelpers.time.latest());
  return {
    batchCode: code,
    harvestGroupId: group,
    farmLocation: "Ben Tre, Viet Nam",
    quantityKg: 1000n,
    harvestDate: BigInt(now),
    expiryDate: BigInt(now + THIRTY_DAYS),
  };
}

async function createLot(fx: Fx, code: string, farmer = fx.farmerA, group = "HG-A01") {
  const info = await newInfo(code, group);
  await fx.contract.connect(farmer).createBatch(info, CID, H_META, H_CERT, H_IMG);
  return info;
}

async function request(fx: Fx, tokenId: bigint, from: any, to: string) {
  await fx.contract.connect(from).requestTransfer(tokenId, to);
  return (await fx.contract.getPendingTransfer(tokenId)).requestId as bigint;
}

async function toInTransit(fx: Fx, tokenId: bigint) {
  const rid = await request(fx, tokenId, fx.farmerA, fx.logistics.address);
  await fx.contract.connect(fx.logistics).acceptTransfer(tokenId, rid, H);
}

async function toDelivered(fx: Fx, tokenId: bigint) {
  const rid = await request(fx, tokenId, fx.logistics, fx.retailer.address);
  await fx.contract.connect(fx.retailer).acceptTransfer(tokenId, rid, H);
}

// tokenId 1 (owner farmerA, Created); tokenId 2 đã Delivered cho retailer và có incidentId 1.
// requestId 1 và 2 đã dùng cho lô 2; yêu cầu tiếp theo có requestId 3.
async function twoLotFixture() {
  const fx = await deployFixture();
  const info1 = await createLot(fx, "COCONUT-001");
  await createLot(fx, "COCONUT-002");
  await toInTransit(fx, 2n);
  await toDelivered(fx, 2n);
  await fx.contract.connect(fx.retailer).reportIncident(2n, REPORT_CID, REPORT_HASH);
  return { ...fx, info1 };
}

// lô 1 InTransit (requestId 3, owner logistics)
async function inTransitFixture() {
  const fx = await twoLotFixture();
  await toInTransit(fx, 1n);
  return fx;
}

// lô 1 Delivered (requestId 4, owner retailer)
async function deliveredFixture() {
  const fx = await inTransitFixture();
  await toDelivered(fx, 1n);
  return fx;
}

async function soldFixture() {
  const fx = await deliveredFixture();
  await fx.contract.connect(fx.retailer).markSold(1n);
  return fx;
}

describe("P03-08, C13: recordTransit", function () {
  it("chủ là logistics (InTransit) ghi reading; sinh TransitRecorded", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(contract.connect(logistics).recordTransit(1n, 1n, 1000, t, LOC))
      .to.emit(contract, "TransitRecorded")
      .withArgs(1n, 1n, 1000n, t, LOC);
  });

  it("readingId trùng thì ReadingUsed(1, 1)", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await contract.connect(logistics).recordTransit(1n, 1n, 1000, t, LOC);
    await expect(contract.connect(logistics).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(contract, "ReadingUsed")
      .withArgs(1n, 1n);
  });

  it("người lạ hoặc chủ cũ gọi thì NotTokenOwner", async function () {
    const { contract, stranger, farmerA } = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(contract.connect(stranger).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, stranger.address);
    await expect(contract.connect(farmerA).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, farmerA.address);
  });

  it("lô ở Created: logistics không giữ thì NotTokenOwner; farmer (chủ) gọi thì InvalidLifecycle", async function () {
    const fx = await networkHelpers.loadFixture(twoLotFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(fx.contract.connect(fx.logistics).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(fx.contract, "NotTokenOwner")
      .withArgs(1n, fx.logistics.address);
    await expect(fx.contract.connect(fx.farmerA).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(fx.contract, "InvalidLifecycle")
      .withArgs(1n, CREATED);
  });

  it("5 reading (10, 12, 18, 13, 11 độ C) đều được ghi; contract không tự cảnh báo", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    const temps = [1000, 1200, 1800, 1300, 1100];
    for (let i = 0; i < temps.length; i++) {
      await expect(contract.connect(logistics).recordTransit(1n, BigInt(i + 1), temps[i], t, LOC))
        .to.emit(contract, "TransitRecorded")
        .withArgs(1n, BigInt(i + 1), BigInt(temps[i]), t, LOC);
    }
  });

  it("nhiệt độ âm được chấp nhận (int32)", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(contract.connect(logistics).recordTransit(1n, 1n, -250, t, LOC))
      .to.emit(contract, "TransitRecorded")
      .withArgs(1n, 1n, -250n, t, LOC);
  });
});

describe("X04: recordTransit thời điểm quan sát", function () {
  it("observedAt ở tương lai thì InvalidObservedAt", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const future = BigInt(Number(await networkHelpers.time.latest()) + 3600);
    await expect(contract.connect(logistics).recordTransit(1n, 1n, 1000, future, LOC)).to.be.revertedWithCustomError(
      contract,
      "InvalidObservedAt",
    );
  });

  it("lùi so với lần trước thì InvalidObservedAt(T-1, T); bằng thì được", async function () {
    const { contract, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    const T = BigInt(await networkHelpers.time.latest());
    await contract.connect(logistics).recordTransit(1n, 1n, 1000, T, LOC);
    await expect(contract.connect(logistics).recordTransit(1n, 2n, 1000, T - 1n, LOC))
      .to.be.revertedWithCustomError(contract, "InvalidObservedAt")
      .withArgs(T - 1n, T);
    await expect(contract.connect(logistics).recordTransit(1n, 3n, 1000, T, LOC)).to.emit(contract, "TransitRecorded");
  });
});

describe("P03-09, C14: markSold", function () {
  it("retailer giữ lô Delivered bán thì Sold, owner không đổi, BatchSold(1, retailer, thời gian block)", async function () {
    const { contract, retailer } = await networkHelpers.loadFixture(deliveredFixture);
    const next = (await networkHelpers.time.latest()) + 10;
    await networkHelpers.time.setNextBlockTimestamp(next);
    await expect(contract.connect(retailer).markSold(1n))
      .to.emit(contract, "BatchSold")
      .withArgs(1n, retailer.address, BigInt(next));
    expect((await contract.getBatch(1n)).lifecycle).to.equal(SOLD);
    expect(await contract.ownerOf(1n)).to.equal(retailer.address);
  });

  it("gọi lại thì BatchLocked(1, Sold)", async function () {
    const { contract, retailer } = await networkHelpers.loadFixture(soldFixture);
    await expect(contract.connect(retailer).markSold(1n))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_SOLD);
  });

  it("lô chưa Delivered: retailer không giữ thì NotTokenOwner; logistics (chủ) thì InvalidLifecycle", async function () {
    const { contract, retailer, logistics } = await networkHelpers.loadFixture(inTransitFixture);
    await expect(contract.connect(retailer).markSold(1n))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, retailer.address);
    await expect(contract.connect(logistics).markSold(1n))
      .to.be.revertedWithCustomError(contract, "InvalidLifecycle")
      .withArgs(1n, IN_TRANSIT);
  });

  it("người lạ thì NotTokenOwner", async function () {
    const { contract, stranger } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(contract.connect(stranger).markSold(1n))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, stranger.address);
  });
});

describe("P03-10, C16, X06: reportIncident", function () {
  it("retailer giữ lô Delivered báo sự cố: incidentId tăng, getIncident đọc được", async function () {
    const { contract, retailer } = await networkHelpers.loadFixture(deliveredFixture);
    // incidentId 1 đã dùng cho lô 2
    await expect(contract.connect(retailer).reportIncident(1n, REPORT_CID, REPORT_HASH))
      .to.emit(contract, "IncidentReported")
      .withArgs(2n, 1n, retailer.address, REPORT_CID, REPORT_HASH);
    const inc = await contract.getIncident(2n);
    expect(inc.incidentId).to.equal(2n);
    expect(inc.tokenId).to.equal(1n);
    expect(inc.reporter).to.equal(retailer.address);
    expect(inc.reportCID).to.equal(REPORT_CID);
    expect(inc.reportHash).to.equal(REPORT_HASH);
    expect(inc.timestamp).to.be.greaterThan(0n);
  });

  it("sau markSold vẫn báo được; incident cũ không đổi", async function () {
    const { contract, retailer } = await networkHelpers.loadFixture(soldFixture);
    await contract.connect(retailer).reportIncident(1n, REPORT_CID, REPORT_HASH);
    const inc1 = await contract.getIncident(1n);
    expect(inc1.tokenId).to.equal(2n);
    expect(inc1.reportHash).to.equal(REPORT_HASH);
    expect((await contract.getIncident(2n)).tokenId).to.equal(1n);
  });

  it("người lạ và farmer thì NotTokenOwner", async function () {
    const { contract, stranger, farmerA } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(contract.connect(stranger).reportIncident(1n, REPORT_CID, REPORT_HASH))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, stranger.address);
    await expect(contract.connect(farmerA).reportIncident(1n, REPORT_CID, REPORT_HASH))
      .to.be.revertedWithCustomError(contract, "NotTokenOwner")
      .withArgs(1n, farmerA.address);
  });

  it("X06: lô chưa giao: retailer thì NotTokenOwner; chủ (logistics) thì InvalidLifecycle; không ghi incident", async function () {
    const fx = await networkHelpers.loadFixture(inTransitFixture);
    await expect(
      fx.contract.connect(fx.retailer).reportIncident(1n, REPORT_CID, REPORT_HASH),
    ).to.be.revertedWithCustomError(fx.contract, "NotTokenOwner");
    await expect(fx.contract.connect(fx.logistics).reportIncident(1n, REPORT_CID, REPORT_HASH))
      .to.be.revertedWithCustomError(fx.contract, "InvalidLifecycle")
      .withArgs(1n, IN_TRANSIT);
    await expect(fx.contract.getIncident(2n)).to.be.revertedWithCustomError(fx.contract, "UnknownIncident");
  });

  it("X06: CID rỗng hoặc hash 0 thì EmptyReport, không ghi incident", async function () {
    const { contract, retailer } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(contract.connect(retailer).reportIncident(1n, "", REPORT_HASH)).to.be.revertedWithCustomError(
      contract,
      "EmptyReport",
    );
    await expect(
      contract.connect(retailer).reportIncident(1n, REPORT_CID, ethers.ZeroHash),
    ).to.be.revertedWithCustomError(contract, "EmptyReport");
    await expect(contract.getIncident(2n)).to.be.revertedWithCustomError(contract, "UnknownIncident").withArgs(2n);
  });

  it("getIncident(0) và incident chưa có thì UnknownIncident", async function () {
    const { contract } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(contract.getIncident(0n)).to.be.revertedWithCustomError(contract, "UnknownIncident").withArgs(0n);
    await expect(contract.getIncident(99n)).to.be.revertedWithCustomError(contract, "UnknownIncident").withArgs(99n);
  });
});

describe("P03-10, C17, X01, X02: recallBatch", function () {
  it("C17: admin recall lô Sold bằng incident 1 (của lô khác): recalled true, lifecycle và owner giữ nguyên", async function () {
    const { contract, admin, retailer } = await networkHelpers.loadFixture(soldFixture);
    await expect(contract.connect(admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH))
      .to.emit(contract, "BatchRecalled")
      .withArgs(1n, 1n, admin.address, REASON_CID, REASON_HASH);
    const b = await contract.getBatch(1n);
    expect(b.recalled).to.equal(true);
    expect(b.lifecycle).to.equal(SOLD);
    expect(await contract.ownerOf(1n)).to.equal(retailer.address);
  });

  it("C17: recall lần hai thì AlreadyRecalled(1)", async function () {
    const { contract, admin } = await networkHelpers.loadFixture(soldFixture);
    await contract.connect(admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await expect(contract.connect(admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH))
      .to.be.revertedWithCustomError(contract, "AlreadyRecalled")
      .withArgs(1n);
  });

  it("chỉ admin: người khác thì AccessControlUnauthorizedAccount", async function () {
    const { contract, stranger, retailer } = await networkHelpers.loadFixture(soldFixture);
    for (const s of [stranger, retailer]) {
      await expect(contract.connect(s).recallBatch(1n, 1n, REASON_CID, REASON_HASH))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount")
        .withArgs(s.address, ethers.ZeroHash);
    }
  });

  it("X01: incident không tồn tại (99 và 0) thì UnknownIncident; lý do rỗng thì EmptyReason; recalled vẫn false", async function () {
    const { contract, admin } = await networkHelpers.loadFixture(soldFixture);
    await expect(contract.connect(admin).recallBatch(1n, 99n, REASON_CID, REASON_HASH))
      .to.be.revertedWithCustomError(contract, "UnknownIncident")
      .withArgs(99n);
    await expect(contract.connect(admin).recallBatch(1n, 0n, REASON_CID, REASON_HASH))
      .to.be.revertedWithCustomError(contract, "UnknownIncident")
      .withArgs(0n);
    await expect(contract.connect(admin).recallBatch(1n, 1n, "", REASON_HASH)).to.be.revertedWithCustomError(
      contract,
      "EmptyReason",
    );
    await expect(
      contract.connect(admin).recallBatch(1n, 1n, REASON_CID, ethers.ZeroHash),
    ).to.be.revertedWithCustomError(contract, "EmptyReason");
    expect((await contract.getBatch(1n)).recalled).to.equal(false);
  });

  it("X02: recall không lan sang lô khác", async function () {
    const fx = await networkHelpers.loadFixture(twoLotFixture);
    await createLot(fx, "COCONUT-003", fx.farmerA, "HG-A02");
    await createLot(fx, "COCONUT-004", fx.farmerB, "HG-B01");
    await fx.contract.connect(fx.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await fx.contract.connect(fx.admin).recallBatch(2n, 1n, REASON_CID, REASON_HASH);
    expect((await fx.contract.getBatch(1n)).recalled).to.equal(true);
    expect((await fx.contract.getBatch(2n)).recalled).to.equal(true);
    expect((await fx.contract.getBatch(3n)).recalled).to.equal(false);
    expect((await fx.contract.getBatch(4n)).recalled).to.equal(false);
    await expect(fx.contract.connect(fx.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH))
      .to.be.revertedWithCustomError(fx.contract, "AlreadyRecalled")
      .withArgs(1n);
  });

  it("recall được cả khi lô đã hết hạn (không bị khóa lô)", async function () {
    const { contract, admin, info1 } = await networkHelpers.loadFixture(deliveredFixture);
    await networkHelpers.time.increaseTo(Number(info1.expiryDate) + 1);
    await expect(contract.connect(admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH)).to.emit(
      contract,
      "BatchRecalled",
    );
  });
});

describe("C15: khóa lô Sold / Expired / Recalled (phần còn lại)", function () {
  it("Sold: requestTransfer, recordTransit, markSold đều BatchLocked(1, Sold)", async function () {
    const { contract, retailer, logistics } = await networkHelpers.loadFixture(soldFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(contract.connect(retailer).requestTransfer(1n, logistics.address))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_SOLD);
    await expect(contract.connect(retailer).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_SOLD);
    await expect(contract.connect(retailer).markSold(1n))
      .to.be.revertedWithCustomError(contract, "BatchLocked")
      .withArgs(1n, LOCK_SOLD);
  });

  it("Expired: recordTransit thì BatchLocked(1, Expired); lifecycle gốc giữ nguyên", async function () {
    const fx = await networkHelpers.loadFixture(inTransitFixture);
    const t = BigInt(await networkHelpers.time.latest());
    await networkHelpers.time.increaseTo(Number(fx.info1.expiryDate) + 1);
    await expect(fx.contract.connect(fx.logistics).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(fx.contract, "BatchLocked")
      .withArgs(1n, LOCK_EXPIRED);
    expect((await fx.contract.getBatch(1n)).lifecycle).to.equal(IN_TRANSIT);
    expect(await fx.contract.isExpired(1n)).to.equal(true);
  });

  it("Expired: markSold thì BatchLocked(1, Expired)", async function () {
    const fd = await networkHelpers.loadFixture(deliveredFixture);
    await networkHelpers.time.increaseTo(Number(fd.info1.expiryDate) + 1);
    await expect(fd.contract.connect(fd.retailer).markSold(1n))
      .to.be.revertedWithCustomError(fd.contract, "BatchLocked")
      .withArgs(1n, LOCK_EXPIRED);
  });

  it("Recalled: request và accept thì BatchLocked(1, Recalled)", async function () {
    const fx = await networkHelpers.loadFixture(twoLotFixture);
    await fx.contract.connect(fx.farmerA).requestTransfer(1n, fx.logistics.address); // requestId 3
    await fx.contract.connect(fx.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await expect(fx.contract.connect(fx.logistics).acceptTransfer(1n, 3n, H))
      .to.be.revertedWithCustomError(fx.contract, "BatchLocked")
      .withArgs(1n, LOCK_RECALLED);
    await fx.contract.connect(fx.farmerA).cancelTransfer(1n, 3n);
    await expect(fx.contract.connect(fx.farmerA).requestTransfer(1n, fx.logistics.address))
      .to.be.revertedWithCustomError(fx.contract, "BatchLocked")
      .withArgs(1n, LOCK_RECALLED);
  });

  it("Recalled: recordTransit thì BatchLocked(1, Recalled)", async function () {
    const fi = await networkHelpers.loadFixture(inTransitFixture);
    await fi.contract.connect(fi.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    const t = BigInt(await networkHelpers.time.latest());
    await expect(fi.contract.connect(fi.logistics).recordTransit(1n, 1n, 1000, t, LOC))
      .to.be.revertedWithCustomError(fi.contract, "BatchLocked")
      .withArgs(1n, LOCK_RECALLED);
  });

  it("Recalled: markSold thì BatchLocked(1, Recalled)", async function () {
    const fd = await networkHelpers.loadFixture(deliveredFixture);
    await fd.contract.connect(fd.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await expect(fd.contract.connect(fd.retailer).markSold(1n))
      .to.be.revertedWithCustomError(fd.contract, "BatchLocked")
      .withArgs(1n, LOCK_RECALLED);
  });

  it("reportIncident vẫn được khi đã hết hạn và đã recall (BR07)", async function () {
    const fx = await networkHelpers.loadFixture(deliveredFixture);
    await fx.contract.connect(fx.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await networkHelpers.time.increaseTo(Number(fx.info1.expiryDate) + 1);
    await expect(fx.contract.connect(fx.retailer).reportIncident(1n, REPORT_CID, REPORT_HASH)).to.emit(
      fx.contract,
      "IncidentReported",
    );
  });
});

describe("X08: pending còn tồn sau recall", function () {
  it("accept bị BatchLocked(Recalled); cancel vẫn thành công", async function () {
    const fx = await networkHelpers.loadFixture(twoLotFixture);
    await fx.contract.connect(fx.farmerA).requestTransfer(1n, fx.logistics.address); // requestId 3
    await fx.contract.connect(fx.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await expect(fx.contract.connect(fx.logistics).acceptTransfer(1n, 3n, H))
      .to.be.revertedWithCustomError(fx.contract, "BatchLocked")
      .withArgs(1n, LOCK_RECALLED);
    expect((await fx.contract.getPendingTransfer(1n)).active).to.equal(true);
    await expect(fx.contract.connect(fx.farmerA).cancelTransfer(1n, 3n)).to.emit(fx.contract, "TransferCancelled");
  });

  it("reject vẫn thành công", async function () {
    const f2 = await networkHelpers.loadFixture(twoLotFixture);
    await f2.contract.connect(f2.farmerA).requestTransfer(1n, f2.logistics.address); // requestId 3
    await f2.contract.connect(f2.admin).recallBatch(1n, 1n, REASON_CID, REASON_HASH);
    await expect(f2.contract.connect(f2.logistics).rejectTransfer(1n, 3n)).to.emit(f2.contract, "TransferRejected");
  });
});

describe("X07: tokenId không tồn tại (hàm mới)", function () {
  it("recordTransit, markSold, reportIncident, recallBatch với 0 và 999 thì BatchNotFound", async function () {
    const { contract, admin, logistics, retailer } = await networkHelpers.loadFixture(deliveredFixture);
    const t = BigInt(await networkHelpers.time.latest());
    for (const id of [0n, 999n]) {
      await expect(contract.connect(logistics).recordTransit(id, 1n, 1000, t, LOC))
        .to.be.revertedWithCustomError(contract, "BatchNotFound")
        .withArgs(id);
      await expect(contract.connect(retailer).markSold(id))
        .to.be.revertedWithCustomError(contract, "BatchNotFound")
        .withArgs(id);
      await expect(contract.connect(retailer).reportIncident(id, REPORT_CID, REPORT_HASH))
        .to.be.revertedWithCustomError(contract, "BatchNotFound")
        .withArgs(id);
      await expect(contract.connect(admin).recallBatch(id, 1n, REASON_CID, REASON_HASH))
        .to.be.revertedWithCustomError(contract, "BatchNotFound")
        .withArgs(id);
    }
  });
});

describe("P03-11, C11: chặn đi vòng luồng bàn giao", function () {
  const ST3 = "safeTransferFrom(address,address,uint256)";
  const ST4 = "safeTransferFrom(address,address,uint256,bytes)";

  it("transferFrom và hai bản safeTransferFrom đều DirectTransferDisabled; owner không đổi", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(twoLotFixture);
    const c = contract.connect(farmerA) as any;
    await expect(c.transferFrom(farmerA.address, logistics.address, 1n)).to.be.revertedWithCustomError(
      contract,
      "DirectTransferDisabled",
    );
    await expect(c[ST3](farmerA.address, logistics.address, 1n)).to.be.revertedWithCustomError(
      contract,
      "DirectTransferDisabled",
    );
    await expect(c[ST4](farmerA.address, logistics.address, 1n, "0x")).to.be.revertedWithCustomError(
      contract,
      "DirectTransferDisabled",
    );
    expect(await contract.ownerOf(1n)).to.equal(farmerA.address);
  });

  it("approve và setApprovalForAll đều DirectTransferDisabled", async function () {
    const { contract, farmerA, logistics } = await networkHelpers.loadFixture(twoLotFixture);
    await expect(contract.connect(farmerA).approve(logistics.address, 1n)).to.be.revertedWithCustomError(
      contract,
      "DirectTransferDisabled",
    );
    await expect(contract.connect(farmerA).setApprovalForAll(logistics.address, true)).to.be.revertedWithCustomError(
      contract,
      "DirectTransferDisabled",
    );
    expect(await contract.getApproved(1n)).to.equal(ethers.ZeroAddress);
    expect(await contract.isApprovedForAll(farmerA.address, logistics.address)).to.equal(false);
  });

  it("admin cũng không chuyển hộ được; lô đã Delivered cũng bị chặn", async function () {
    const { contract, admin, retailer, farmerA } = await networkHelpers.loadFixture(deliveredFixture);
    await expect(
      (contract.connect(admin) as any).transferFrom(retailer.address, farmerA.address, 1n),
    ).to.be.revertedWithCustomError(contract, "DirectTransferDisabled");
    await expect(
      (contract.connect(retailer) as any).transferFrom(retailer.address, farmerA.address, 1n),
    ).to.be.revertedWithCustomError(contract, "DirectTransferDisabled");
    expect(await contract.ownerOf(1n)).to.equal(retailer.address);
  });
});

describe("C12: reentrancy qua onERC721Received", function () {
  it("gọi lại trong callback đều thất bại; chỉ một lần chuyển; pending đã đóng trước callback", async function () {
    const fx = await networkHelpers.loadFixture(deployFixture);
    const mock = await ethers.deployContract("MaliciousReceiver", [await fx.contract.getAddress()]);
    const mockAddr = await mock.getAddress();
    await fx.contract.connect(fx.admin).grantRole(fx.LOGISTICS_ROLE, mockAddr);
    await createLot(fx, "COCONUT-001");
    await fx.contract.connect(fx.farmerA).requestTransfer(1n, mockAddr);

    await mock.accept(1n, 1n, H);

    expect(await mock.callbackRan()).to.equal(true);
    expect(await mock.reentrySucceeded()).to.equal(0n);
    expect(await mock.pendingActiveInCallback()).to.equal(false);
    expect(await mock.acceptRevertSelector()).to.equal(
      fx.contract.interface.getError("ReentrancyGuardReentrantCall")!.selector,
    );
    expect(await fx.contract.ownerOf(1n)).to.equal(mockAddr);
    const logs = await fx.contract.queryFilter(fx.contract.filters.Transfer(null, null, 1n));
    expect(logs.length).to.equal(2); // mint + một lần chuyển
  });
});

async function singleDeliveredFixture() {
  const fx = await deployFixture();
  await createLot(fx, "COCONUT-001");
  await toInTransit(fx, 1n);
  await toDelivered(fx, 1n);
  return fx;
}

describe("C18: tokenURI và lịch sử Transfer", function () {
  it("tokenURI là ipfs://CID; log Transfer đủ 3 bản ghi và khớp ownerOf", async function () {
    const { contract, farmerA, logistics, retailer } = await networkHelpers.loadFixture(singleDeliveredFixture);
    expect(await contract.tokenURI(1n)).to.equal("ipfs://" + CID);
    const logs = await contract.queryFilter(contract.filters.Transfer(null, null, 1n));
    expect(logs.length).to.equal(3);
    const pairs = logs.map((l: any) => [l.args.from, l.args.to]);
    expect(pairs).to.deep.equal([
      [ethers.ZeroAddress, farmerA.address],
      [farmerA.address, logistics.address],
      [logistics.address, retailer.address],
    ]);
    expect(pairs[2][1]).to.equal(await contract.ownerOf(1n));
  });
});
