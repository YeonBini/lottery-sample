// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;

contract Lottery {
    struct BetInfo {
        uint256 answerBlockNumber;
        address payable bettor;
        bytes1 challenges;
    }

    uint256 private _tail;
    uint256 private _head;
    mapping(uint256 => BetInfo) private _bets;

    address payable public owner;

    uint256 internal constant BET_BLOCK_LIMIT = 256;
    uint256 internal constant BET_BLOCK_INTERVAL = 3;
    uint256 internal constant BET_AMOUNT = 5 * 10**15;
    uint256 private _pot;
    bool private mode = false; // false : use answer for test, true : real block hash 
    bytes32 public answerForTest; 

    enum BettingResult { Fail, Win, Draw }
    enum BlockStatus { Checkable, NotRevealed, BlockLimitPassed } 

    event BET(
        uint256 index,
        address bettor,
        uint256 amount,
        bytes1 challenges,
        uint256 answerBlockNumber
    );

    event WIN(
        uint256 index,
        address bettor,
        uint256 amount,
        bytes1 challenges,
        bytes1 answer,
        uint256 answerBlockNumber
    );
    event FAIL(
        uint256 index,
        address bettor,
        uint256 amount,
        bytes1 challenges,
        bytes1 answer,
        uint256 answerBlockNumber
    );
    event DRAW(
        uint256 index,
        address bettor,
        uint256 amount,
        bytes1 challenges,
        bytes1 answer,
        uint256 answerBlockNumber
    );
    event REFUND(
        uint256 index,
        address bettor,
        uint256 amount,
        bytes1 challenges,
        uint256 answerBlockNumber
    );
    event NOT_REVEALED(
        string message
    );
    
    constructor() public {
        owner = msg.sender;
    }

    function getPot() public view returns (uint256 value) {
        return _pot;
    }

    /**
     * @dev bet and distribute function. 
     * @param challenges : 1 byte bet
     * @return result represents function works properly
     */
    function betAndDistribute(byte challenges) public payable returns (bool result) {
        bet(challenges);
        distribute();
        return true; 
    }

    // bet
    /**
     * @dev bet function. user must send 0.005 eth and send 1 byte challenges
     * @param challenges : 1 byte bet
     * @return result which represents function works properly
     */
    function bet(bytes1 challenges) public payable returns (bool result) {
        // check the proper ether amount is sent
        require(msg.value == BET_AMOUNT, "Not enough ETH");

        // push bet to the queue
        require(pushBet(challenges), "Fail to add new Bet Info");

        // emit event
        emit BET(
            _tail - 1,
            msg.sender,
            msg.value,
            challenges,
            block.number + BET_BLOCK_INTERVAL
        );
        return true;
    }

    /**
     * @dev 베팅 결과값을 확인하고 팟 머니를 분배한다. 
     * 정답 실패 : 팟 머니 축적, 정답 성공 : 팟머니 획득, 한 글자 맞춤 or 정답 확인 불가: 배팅금액만 획득 
     */
    function distribute() public {
        uint256 curr;
        uint256 transferAmount;

        BetInfo memory b;  
        BlockStatus currBlockStatus; 
        BettingResult currBettingResult; 

        for(curr=_head; curr <_tail; curr++) {
            b = _bets[curr];
            currBlockStatus = getBlockStatus(b.answerBlockNumber);
            // Checkable => 1
            if(currBlockStatus == BlockStatus.Checkable) {
                bytes32 answerBlockHash = getAnswerBlockHashNumber(b.answerBlockNumber);
                currBettingResult = isMatch(b.challenges, answerBlockHash);
                // if win, bettor gets popt
                if(currBettingResult == BettingResult.Win) {
                    // transfer pot 
                    transferAmount = transferAfterPayingFee(b.bettor, _pot + BET_AMOUNT);

                    // pot = 0 
                    _pot = 0; 

                    // emit win event
                    emit WIN(curr, b.bettor, transferAmount, b.challenges, answerBlockHash[0], b.answerBlockNumber);
                }

                // if fail, bettor's money goes to pot 
                if(currBettingResult == BettingResult.Fail) {
                    // pot += BET_AMOUNT
                    _pot += BET_AMOUNT;

                    // emit fail event 
                    emit FAIL(curr, b.bettor, 0, b.challenges, answerBlockHash[0], b.answerBlockNumber);
                }

                // if draw, refund bettor's money 
                if(currBettingResult == BettingResult.Draw) {
                    // transfer only BET_AMOUNT 
                    transferAmount = transferAfterPayingFee(b.bettor, BET_AMOUNT);

                    // emit draw event
                    emit DRAW(curr, b.bettor, BET_AMOUNT, b.challenges, answerBlockHash[0], b.answerBlockNumber);
                }
            }
            // Not revealed => 2
            if(currBlockStatus == BlockStatus.NotRevealed) {
                emit NOT_REVEALED('Not Revealed');
                break;
            }

            // Block limit passed => 3
            if(currBlockStatus == BlockStatus.BlockLimitPassed) {
                // refund 
                transferAmount = transferAfterPayingFee(b.bettor, BET_AMOUNT);

                // emit refund
                emit REFUND(curr, b.bettor, BET_AMOUNT, b.challenges, b.answerBlockNumber);
            }
            popBet(curr);
        } 
        _head = curr;
    }

    function transferAfterPayingFee(address payable addr, uint256 amount) internal returns (uint256) {
        // uint256 fee = amount / 100;
        uint256 fee = 0;
        uint256 amountWithoutFee = amount - fee; 

        // transfer to addr
        addr.transfer(amountWithoutFee);

        // transfer to owner   
        owner.transfer(fee);

        return amountWithoutFee; 
    }

    function setAnswerForTest(bytes32 answer) public returns (bool result) {
        require(msg.sender == owner, "Only owner can set the answer for test mode");
        answerForTest = answer;
        return true;
    }

    function getAnswerBlockHashNumber(uint256 answerBlockNumber) internal view returns (bytes32 answer) {
        return mode ? blockhash(answerBlockNumber) : answerForTest;
    }

    /**
     * @dev check challenges with answer 
     * @param challenges : Character of Bet
     * @param answer : block hash
     * @return Betting Result
     */
    function isMatch(byte challenges, bytes32 answer) public pure returns (BettingResult) {
        // challenges 0xab
        // answer 0xab........ff 32 bytes

        byte c1 = challenges; 
        byte c2 = challenges; 

        byte a1 = answer[0]; 
        byte a2 = answer[0];

        // Get first number 
        c1 = c1 >> 4; // 0xab => 0x0a
        c1 = c1 << 4; // 0x0a => 0xa0 
        
        a1 = a1 >> 4; // 0xab => 0x0a
        a1 = a1 << 4; // 0x0a => 0xa0 

        // Get Second number 
        c2 = c2 << 4; // 0xab => 0xb0 
        c2 = c2 >> 4; // 0xb0 => 0x0b

        a2 = a2 << 4; // 0xab => 0xb0 
        a2 = a2 >> 4; // 0xb0 => 0x0b

        if(a1 == c1 && a2 == c2) {
            return BettingResult.Win;
        }

        if(a1 == c1 || a2 == c2) {
            return BettingResult.Draw;
        }
        return BettingResult.Fail;
    }

    function getBlockStatus(uint256 answerBlockNumber) internal view returns (BlockStatus) {
        if(block.number > answerBlockNumber && block.number < BET_BLOCK_LIMIT + answerBlockNumber) {
            return BlockStatus.Checkable; 
        } else if(block.number <= answerBlockNumber) {
            return BlockStatus.NotRevealed; 
        } else if(block.number >= answerBlockNumber + BET_BLOCK_LIMIT) {
            return BlockStatus.BlockLimitPassed;
        }
        return BlockStatus.BlockLimitPassed;
    }

    function getBetInfo(uint256 index)
        public
        view
        returns (
            uint256 answerBlockNumber,
            address bettor,
            bytes1 challenges
        )
    {
        BetInfo memory b = _bets[index];
        answerBlockNumber = b.answerBlockNumber;
        bettor = b.bettor;
        challenges = b.challenges;
    }

    function pushBet(bytes1 challenges) internal returns (bool) {
        BetInfo memory b;
        b.bettor = msg.sender;
        b.answerBlockNumber = block.number + BET_BLOCK_INTERVAL;
        b.challenges = challenges;

        _bets[_tail] = b;
        _tail++;

        return true;
    }

    function popBet(uint256 index) internal returns (bool) {
        delete _bets[index];
        return true;
    }
}
