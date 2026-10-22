// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Mock chỉ dùng cho test C12: bên nhận cố gọi lại contract trong onERC721Received.
contract MaliciousReceiver {
    address public immutable target;
    bytes32[3] private _hashes;

    bool public callbackRan;
    bool public pendingActiveInCallback;
    uint256 public reentrySucceeded;
    bytes4 public acceptRevertSelector;

    constructor(address target_) {
        target = target_;
    }

    function accept(uint256 tokenId, uint256 requestId, bytes32[3] calldata hashes) external {
        _hashes = hashes;
        (bool ok, bytes memory ret) = target.call(
            abi.encodeWithSignature("acceptTransfer(uint256,uint256,bytes32[3])", tokenId, requestId, hashes)
        );
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
    }

    function onERC721Received(address, address, uint256 tokenId, bytes calldata) external returns (bytes4) {
        callbackRan = true;

        (bool okRead, bytes memory data) = target.staticcall(
            abi.encodeWithSignature("getPendingTransfer(uint256)", tokenId)
        );
        if (okRead) {
            (, , , , bool active) = abi.decode(data, (uint256, uint256, address, address, bool));
            pendingActiveInCallback = active;
        }

        (bool ok1, bytes memory ret1) = target.call(
            abi.encodeWithSignature("acceptTransfer(uint256,uint256,bytes32[3])", tokenId, 1, _hashes)
        );
        if (ok1) reentrySucceeded++;
        if (!ok1 && ret1.length >= 4) {
            bytes4 sel;
            assembly {
                sel := mload(add(ret1, 32))
            }
            acceptRevertSelector = sel;
        }
        (bool ok2, ) = target.call(abi.encodeWithSignature("requestTransfer(uint256,address)", tokenId, msg.sender));
        if (ok2) reentrySucceeded++;
        (bool ok3, ) = target.call(abi.encodeWithSignature("markSold(uint256)", tokenId));
        if (ok3) reentrySucceeded++;
        (bool ok4, ) = target.call(
            abi.encodeWithSignature(
                "recordTransit(uint256,uint256,int32,uint64,string)",
                tokenId,
                1,
                int32(0),
                uint64(0),
                "x"
            )
        );
        if (ok4) reentrySucceeded++;

        return this.onERC721Received.selector;
    }
}
