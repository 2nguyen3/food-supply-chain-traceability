// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FoodTraceability is ERC721URIStorage, AccessControl, ReentrancyGuard {
    // --- Roles and Constants ---
    bytes32 public constant ADMIN_ROLE     = DEFAULT_ADMIN_ROLE; // alias, = 0x00
    bytes32 public constant FARMER_ROLE    = keccak256("FARMER_ROLE");
    bytes32 public constant LOGISTICS_ROLE = keccak256("LOGISTICS_ROLE");
    bytes32 public constant RETAILER_ROLE  = keccak256("RETAILER_ROLE");
    uint256 public constant BATCH_QUANTITY_KG = 1000;

    // --- Types ---
    enum Lifecycle { Created, InTransit, Delivered, Sold }
    enum LockReason { Sold, Expired, Recalled }

    struct BatchInfo {
        string  batchCode;
        string  harvestGroupId;
        string  farmLocation;
        uint256 quantityKg;
        uint64  harvestDate;
        uint64  expiryDate;
    }

    struct Batch {
        uint256 tokenId;
        string  batchCode;
        string  farmId;
        string  farmLocation;
        string  harvestGroupId;
        uint256 quantityKg;
        uint64  harvestDate;
        uint64  expiryDate;
        Lifecycle lifecycle;
        bool    recalled;
        bytes32 metadataHash;
        bytes32 certificateHash;
        bytes32 imageHash;
    }

    struct PendingTransfer {
        uint256 requestId;
        uint256 tokenId;
        address from;
        address to;
        bool    active;
    }

    struct Incident {
        uint256 incidentId;
        uint256 tokenId;
        address reporter;
        string  reportCID;
        bytes32 reportHash;
        uint64  timestamp;
    }

    // --- Storage ---
    mapping(address => string) public farmIdOf;
    mapping(bytes32 => uint256) private _batchCodeToTokenId;
    mapping(uint256 => Batch) private _batches;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => PendingTransfer) private _pendingTransfers;
    uint256 private _nextRequestId = 1;

    mapping(uint256 => mapping(uint256 => bool)) private _readingUsed;
    mapping(uint256 => uint64) private _lastObservedAt;
    mapping(uint256 => Incident) private _incidents;
    uint256 private _nextIncidentId = 1;

    // --- Events ---
    event FarmerAssigned(address indexed farmer, string farmId);
    event BatchCreated(
        uint256 indexed tokenId,
        address indexed farmer,
        string  farmId,
        string  harvestGroupId,
        string  batchCode,
        uint64  harvestDate,
        string  metadataCID,
        bytes32 metadataHash
    );

    event TransferRequested(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 requestId
    );
    event TransferAccepted(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 requestId,
        bytes32 metadataHash,
        bytes32 certificateHash,
        bytes32 imageHash
    );
    event TransferRejected(
        uint256 indexed tokenId,
        uint256 requestId,
        address indexed by
    );
    event TransferCancelled(
        uint256 indexed tokenId,
        uint256 requestId,
        address indexed by
    );

    event TransitRecorded(
        uint256 indexed tokenId,
        uint256 indexed readingId,
        int32 tempCenti,
        uint64 observedAt,
        string location
    );
    event BatchSold(
        uint256 indexed tokenId,
        address indexed retailer,
        uint64 soldAt
    );
    event IncidentReported(
        uint256 indexed incidentId,
        uint256 indexed tokenId,
        address indexed retailer,
        string reportCID,
        bytes32 reportHash
    );
    event BatchRecalled(
        uint256 indexed tokenId,
        uint256 indexed incidentId,
        address indexed admin,
        string reasonCID,
        bytes32 reasonHash
    );

    // --- Custom Errors ---
    error ZeroAddress();
    error EmptyFarmId();
    error FarmNotAssigned(address farmer);
    error EmptyBatchCode();
    error DuplicateBatchCode(string batchCode);
    error InvalidQuantity(uint256 given);
    error InvalidDates(uint64 harvestDate, uint64 expiryDate);
    error EmptyMetadata();

    error BatchNotFound(uint256 tokenId);
    error NotTokenOwner(uint256 tokenId, address caller);
    error NotRecipient(address caller, address expected);
    error NotSender(address caller, address expected);
    error RoleNoLongerValid(address account, bytes32 role);
    error BatchLocked(uint256 tokenId, LockReason reason);
    error InvalidRoute(address from, address to);
    error PendingExists(uint256 tokenId, uint256 requestId);
    error NoActiveRequest(uint256 tokenId);
    error StaleRequest(uint256 given, uint256 active);
    error HashMismatch(uint8 index); // 0 = metadata, 1 = certificate, 2 = image

    error InvalidLifecycle(uint256 tokenId, Lifecycle current);
    error ReadingUsed(uint256 tokenId, uint256 readingId);
    error InvalidObservedAt(uint64 observedAt, uint64 last);
    error EmptyReport();
    error UnknownIncident(uint256 incidentId);
    error AlreadyRecalled(uint256 tokenId);
    error EmptyReason();
    error DirectTransferDisabled();

    constructor() ERC721("Food Traceability Batch", "FTB") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // --- Admin Functions ---
    function assignFarmer(address farmer, string calldata farmId) external onlyRole(ADMIN_ROLE) {
        if (farmer == address(0)) {
            revert ZeroAddress();
        }
        if (bytes(farmId).length == 0) {
            revert EmptyFarmId();
        }

        farmIdOf[farmer] = farmId;
        _grantRole(FARMER_ROLE, farmer);

        emit FarmerAssigned(farmer, farmId);
    }

    // --- Batch Creation ---
    function createBatch(
        BatchInfo calldata info,
        string calldata metadataCID,
        bytes32 metadataHash,
        bytes32 certificateHash,
        bytes32 imageHash
    ) external onlyRole(FARMER_ROLE) nonReentrant returns (uint256) {
        _validateBatch(info, metadataCID, metadataHash, certificateHash, imageHash);

        uint256 tokenId = _nextTokenId;
        _nextTokenId = tokenId + 1;

        string memory farmId = farmIdOf[msg.sender];

        _batches[tokenId] = Batch({
            tokenId: tokenId,
            batchCode: info.batchCode,
            farmId: farmId,
            farmLocation: info.farmLocation,
            harvestGroupId: info.harvestGroupId,
            quantityKg: BATCH_QUANTITY_KG,
            harvestDate: info.harvestDate,
            expiryDate: info.expiryDate,
            lifecycle: Lifecycle.Created,
            recalled: false,
            metadataHash: metadataHash,
            certificateHash: certificateHash,
            imageHash: imageHash
        });

        _batchCodeToTokenId[keccak256(bytes(info.batchCode))] = tokenId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, string.concat("ipfs://", metadataCID));

        _emitCreated(tokenId, farmId, info, metadataCID, metadataHash);

        return tokenId;
    }

    // --- Read Functions ---
    function getBatch(uint256 tokenId) external view returns (Batch memory) {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        return _batches[tokenId];
    }

    function getTokenIdByCode(string calldata batchCode) external view returns (uint256) {
        return _batchCodeToTokenId[keccak256(bytes(batchCode))];
    }

    function getPendingTransfer(uint256 tokenId) external view returns (PendingTransfer memory) {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        return _pendingTransfers[tokenId];
    }

    function isExpired(uint256 tokenId) external view returns (bool) {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        return block.timestamp >= _batches[tokenId].expiryDate;
    }

    function getIncident(uint256 incidentId) external view returns (Incident memory) {
        if (incidentId == 0 || _incidents[incidentId].incidentId == 0) {
            revert UnknownIncident(incidentId);
        }
        return _incidents[incidentId];
    }

    // --- Transfer Workflow ---
    function requestTransfer(uint256 tokenId, address to) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }

        _checkNotLocked(tokenId);

        _validateRoute(_batches[tokenId].lifecycle, msg.sender, to);

        if (_pendingTransfers[tokenId].active) {
            revert PendingExists(tokenId, _pendingTransfers[tokenId].requestId);
        }

        uint256 requestId = _nextRequestId;
        _nextRequestId = requestId + 1;

        _pendingTransfers[tokenId] = PendingTransfer({
            requestId: requestId,
            tokenId: tokenId,
            from: msg.sender,
            to: to,
            active: true
        });

        emit TransferRequested(tokenId, msg.sender, to, requestId);
    }

    function acceptTransfer(
        uint256 tokenId,
        uint256 requestId,
        bytes32[3] calldata hashes
    ) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }

        PendingTransfer storage pending = _pendingTransfers[tokenId];
        if (!pending.active) {
            revert NoActiveRequest(tokenId);
        }
        if (pending.requestId != requestId) {
            revert StaleRequest(requestId, pending.requestId);
        }
        if (msg.sender != pending.to) {
            revert NotRecipient(msg.sender, pending.to);
        }

        _checkNotLocked(tokenId);

        Batch storage batch = _batches[tokenId];
        _validateAcceptRoles(batch.lifecycle, pending.from, pending.to);

        if (hashes[0] != batch.metadataHash) {
            revert HashMismatch(0);
        }
        if (hashes[1] != batch.certificateHash) {
            revert HashMismatch(1);
        }
        if (hashes[2] != batch.imageHash) {
            revert HashMismatch(2);
        }

        pending.active = false;

        if (batch.lifecycle == Lifecycle.Created) {
            batch.lifecycle = Lifecycle.InTransit;
        } else if (batch.lifecycle == Lifecycle.InTransit) {
            batch.lifecycle = Lifecycle.Delivered;
        }

        address from = pending.from;
        address to = pending.to;

        _safeTransfer(from, to, tokenId);

        emit TransferAccepted(
            tokenId,
            from,
            to,
            requestId,
            hashes[0],
            hashes[1],
            hashes[2]
        );
    }

    function rejectTransfer(uint256 tokenId, uint256 requestId) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }

        PendingTransfer storage pending = _pendingTransfers[tokenId];
        if (!pending.active) {
            revert NoActiveRequest(tokenId);
        }
        if (pending.requestId != requestId) {
            revert StaleRequest(requestId, pending.requestId);
        }
        if (msg.sender != pending.to) {
            revert NotRecipient(msg.sender, pending.to);
        }

        pending.active = false;

        emit TransferRejected(tokenId, requestId, msg.sender);
    }

    function cancelTransfer(uint256 tokenId, uint256 requestId) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }

        PendingTransfer storage pending = _pendingTransfers[tokenId];
        if (!pending.active) {
            revert NoActiveRequest(tokenId);
        }
        if (pending.requestId != requestId) {
            revert StaleRequest(requestId, pending.requestId);
        }
        if (msg.sender != pending.from) {
            revert NotSender(msg.sender, pending.from);
        }

        pending.active = false;

        emit TransferCancelled(tokenId, requestId, msg.sender);
    }

    // --- Lifecycle Operations ---
    function recordTransit(
        uint256 tokenId,
        uint256 readingId,
        int32 tempCenti,
        uint64 observedAt,
        string calldata location
    ) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }

        _checkNotLocked(tokenId);

        if (_batches[tokenId].lifecycle != Lifecycle.InTransit) {
            revert InvalidLifecycle(tokenId, _batches[tokenId].lifecycle);
        }

        if (_readingUsed[tokenId][readingId]) {
            revert ReadingUsed(tokenId, readingId);
        }

        if (observedAt > block.timestamp || observedAt < _lastObservedAt[tokenId]) {
            revert InvalidObservedAt(observedAt, _lastObservedAt[tokenId]);
        }

        _readingUsed[tokenId][readingId] = true;
        _lastObservedAt[tokenId] = observedAt;

        emit TransitRecorded(tokenId, readingId, tempCenti, observedAt, location);
    }

    function markSold(uint256 tokenId) external nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }

        _checkNotLocked(tokenId);

        if (_batches[tokenId].lifecycle != Lifecycle.Delivered) {
            revert InvalidLifecycle(tokenId, _batches[tokenId].lifecycle);
        }

        _batches[tokenId].lifecycle = Lifecycle.Sold;

        emit BatchSold(tokenId, msg.sender, uint64(block.timestamp));
    }

    function reportIncident(
        uint256 tokenId,
        string calldata reportCID,
        bytes32 reportHash
    ) external nonReentrant returns (uint256) {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner(tokenId, msg.sender);
        }

        Lifecycle lifecycle = _batches[tokenId].lifecycle;
        if (lifecycle != Lifecycle.Delivered && lifecycle != Lifecycle.Sold) {
            revert InvalidLifecycle(tokenId, lifecycle);
        }

        if (bytes(reportCID).length == 0 || reportHash == bytes32(0)) {
            revert EmptyReport();
        }

        uint256 incidentId = _nextIncidentId;
        _nextIncidentId = incidentId + 1;

        _incidents[incidentId] = Incident({
            incidentId: incidentId,
            tokenId: tokenId,
            reporter: msg.sender,
            reportCID: reportCID,
            reportHash: reportHash,
            timestamp: uint64(block.timestamp)
        });

        emit IncidentReported(incidentId, tokenId, msg.sender, reportCID, reportHash);

        return incidentId;
    }

    function recallBatch(
        uint256 tokenId,
        uint256 incidentId,
        string calldata reasonCID,
        bytes32 reasonHash
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        if (!_existsBatch(tokenId)) {
            revert BatchNotFound(tokenId);
        }
        if (_batches[tokenId].recalled) {
            revert AlreadyRecalled(tokenId);
        }
        if (incidentId == 0 || _incidents[incidentId].incidentId == 0) {
            revert UnknownIncident(incidentId);
        }
        if (bytes(reasonCID).length == 0 || reasonHash == bytes32(0)) {
            revert EmptyReason();
        }

        _batches[tokenId].recalled = true;

        emit BatchRecalled(tokenId, incidentId, msg.sender, reasonCID, reasonHash);
    }

    // --- Disable Direct Transfers & Approvals ---
    function transferFrom(address, address, uint256) public virtual override(ERC721, IERC721) {
        revert DirectTransferDisabled();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public virtual override(ERC721, IERC721) {
        revert DirectTransferDisabled();
    }

    function approve(address, uint256) public virtual override(ERC721, IERC721) {
        revert DirectTransferDisabled();
    }

    function setApprovalForAll(address, bool) public virtual override(ERC721, IERC721) {
        revert DirectTransferDisabled();
    }

    // --- Internal Helpers ---
    function _existsBatch(uint256 tokenId) private view returns (bool) {
        return tokenId != 0 && _batches[tokenId].tokenId != 0;
    }

    function _checkNotLocked(uint256 tokenId) private view {
        Batch storage batch = _batches[tokenId];
        if (batch.lifecycle == Lifecycle.Sold) {
            revert BatchLocked(tokenId, LockReason.Sold);
        }
        if (block.timestamp >= batch.expiryDate) {
            revert BatchLocked(tokenId, LockReason.Expired);
        }
        if (batch.recalled) {
            revert BatchLocked(tokenId, LockReason.Recalled);
        }
    }

    function _validateRoute(
        Lifecycle lifecycle,
        address from,
        address to
    ) private view {
        if (lifecycle == Lifecycle.Created) {
            if (!hasRole(FARMER_ROLE, from) || !hasRole(LOGISTICS_ROLE, to)) {
                revert InvalidRoute(from, to);
            }
        } else if (lifecycle == Lifecycle.InTransit) {
            if (!hasRole(LOGISTICS_ROLE, from) || !hasRole(RETAILER_ROLE, to)) {
                revert InvalidRoute(from, to);
            }
        } else {
            revert InvalidRoute(from, to);
        }
    }

    function _validateAcceptRoles(
        Lifecycle lifecycle,
        address from,
        address to
    ) private view {
        if (lifecycle == Lifecycle.Created) {
            if (!hasRole(FARMER_ROLE, from)) {
                revert RoleNoLongerValid(from, FARMER_ROLE);
            }
            if (!hasRole(LOGISTICS_ROLE, to)) {
                revert RoleNoLongerValid(to, LOGISTICS_ROLE);
            }
        } else if (lifecycle == Lifecycle.InTransit) {
            if (!hasRole(LOGISTICS_ROLE, from)) {
                revert RoleNoLongerValid(from, LOGISTICS_ROLE);
            }
            if (!hasRole(RETAILER_ROLE, to)) {
                revert RoleNoLongerValid(to, RETAILER_ROLE);
            }
        } else {
            revert InvalidRoute(from, to);
        }
    }

    function _validateBatch(
        BatchInfo calldata info,
        string calldata metadataCID,
        bytes32 metadataHash,
        bytes32 certificateHash,
        bytes32 imageHash
    ) private view {
        if (bytes(farmIdOf[msg.sender]).length == 0) {
            revert FarmNotAssigned(msg.sender);
        }
        if (bytes(info.batchCode).length == 0) {
            revert EmptyBatchCode();
        }
        if (_batchCodeToTokenId[keccak256(bytes(info.batchCode))] != 0) {
            revert DuplicateBatchCode(info.batchCode);
        }
        if (info.quantityKg != BATCH_QUANTITY_KG) {
            revert InvalidQuantity(info.quantityKg);
        }
        if (info.harvestDate > block.timestamp || info.expiryDate <= block.timestamp) {
            revert InvalidDates(info.harvestDate, info.expiryDate);
        }
        if (
            bytes(metadataCID).length == 0 ||
            metadataHash == bytes32(0) ||
            certificateHash == bytes32(0) ||
            imageHash == bytes32(0)
        ) {
            revert EmptyMetadata();
        }
    }

    function _emitCreated(
        uint256 tokenId,
        string memory farmId,
        BatchInfo calldata info,
        string calldata metadataCID,
        bytes32 metadataHash
    ) private {
        emit BatchCreated(
            tokenId,
            msg.sender,
            farmId,
            info.harvestGroupId,
            info.batchCode,
            info.harvestDate,
            metadataCID,
            metadataHash
        );
    }

    // --- ERC165 Interface Support ---
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
