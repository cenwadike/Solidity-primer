// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

contract MultiSigWallet {
    event Deposit(address indexed sender, uint amount);
    event Submit(uint indexed txId);
    event Approve(address indexed owner, uint indexed txId);
    event Revoke(address indexed owner, uint indexed txId);
    event Execute(uint indexed txId);

    struct Transaction {
        address destination;
        uint value;
        bytes data;
        bool executed;
    }

    address[] public owners;
    mapping(address => bool) public isOwner;

    uint public requiredApprovals;

    Transaction[] public transactions;
    mapping(uint => mapping (address => bool)) public approved;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Unauthorized: not owner");
        _;
    }

    modifier txExist(uint _txId) {
        require(_txId < transactions.length, "tx does not exists");
        _;
    }

    modifier notApproved(uint _txId) {
        require(!approved[_txId][msg.sender], "tx already approved");
        _;
    }

    modifier notExecuted(uint _txId) {
        require(!transactions[_txId].executed, "tx already executed");
        _;
    }


    constructor(address[] memory _owners, uint _requiredApprovals) {
        require(_owners.length > 0, "Owners required");
        require(_requiredApprovals > 0 && _requiredApprovals <= _owners.length, 
            "Invalid required number of approvals"
        );

        for (uint i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "Invalid address");
            require(!isOwner[owner], "Owners must be unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        requiredApprovals = _requiredApprovals;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    fallback() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function submit(address _destination, uint _value, bytes calldata _data) external onlyOwner {
        transactions.push(Transaction({
            destination: _destination,
            value: _value,
            data: _data,
            executed: false
        }));

        emit Submit(transactions.length - 1);
    }

    function approve(uint _txId) external onlyOwner txExist(_txId) notApproved(_txId) notExecuted(_txId) {
        approved[_txId][msg.sender] = true;

        emit Approve(msg.sender, _txId);
    }

    function revoke(uint _txId) external onlyOwner txExist(_txId) notExecuted(_txId) {
        require(approved[_txId][msg.sender], "tx not approved");

        approved[_txId][msg.sender] = false;

        emit Revoke(msg.sender, _txId);
    }

    function execute(uint _txId) payable external txExist(_txId) notExecuted(_txId) {
        require(_getApprovalCount(_txId) >= requiredApprovals, "Approvals is less than required");
        Transaction storage transaction = transactions[_txId];

        transaction.executed = true;

        (bool success, ) = address(transaction.destination).call{value: transaction.value}(transaction.data);

        // require(success, "tx failed");

        emit Execute(_txId);
    }

    function getTransactionIndex() external view onlyOwner returns (uint) {
        uint index = transactions.length;

        if(index > 0) {
            return index - 1;
        }else {
            return 0;
        }
    }

     function getTransactionDetails(
        uint _txId
    )
        public
        view
        returns (
            address destinantion,
            uint value,
            bytes memory data,
            bool executed
        )
    {
        Transaction memory transaction = transactions[_txId];
        return (
            transaction.destination,
            transaction.value,
            transaction.data,
            transaction.executed
        );
    }

    function _getApprovalCount(uint _txId) private view returns (uint count) {
        for (uint i = 0; i < owners.length; i++) {
            if(approved[_txId][owners[i]]) {
                count++;
            }
        }
    }
}

