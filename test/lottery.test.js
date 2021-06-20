const Lottery = artifacts.require("Lottery");
const { assert } = require('chai');
const assertRevert = require('./assertRevert');
const expectEvent = require('./expectEvent');

contract('Lottery', function([deployer, user1, user2]) {
    let lottery; 
    let betAmount = 5 * 10 ** 15;
    let betAmountBN = new web3.utils.BN('5000000000000000');
    let betBlockInterval = 3; 
    beforeEach(async () => {
        // console.log('Before each');
        lottery = await Lottery.new();
    })

    it('getPot should returns current pot', async () => {
        let pot = await lottery.getPot();
        
        console.log(pot);
        assert.equal(pot, 0);
    })

    describe('Bet', function() {
        it('should fail when the bet money is not 0.005 eth', async () => {
            // fail transaction
            // await assertRevert(lottery.bet('0xab', {from : user1, value : 4000000000000000}));
            // transaction object {chainId, value, to, from ,gas(limit), gasPrice}

        })

        it('should put the bet to the bet queue with 1 bet', async () => {
            
            // bet 
            // let receipt = await lottery.bet('0xab', {from : user1, value:betAmount})
            let receipt = await lottery.bet('0xab', {from : user1, value : betAmount});
            // console.log(receipt);

            // check contract Balance == 0.005 eth 
            let pot = await lottery.getPot();
            assert.equal(pot, 0);

            // check bet info 
            let contractBalance = await web3.eth.getBalance(lottery.address);
            assert.equal(contractBalance, 5 * 10**15);

            // check log
            let currentBlockNumber = await web3.eth.getBlockNumber();
            let bet = await lottery.getBetInfo(0);

            assert.equal(bet.answerBlockNumber, currentBlockNumber + betBlockInterval);
            assert.equal(bet.bettor, user1);
            assert.equal(bet.challenges, '0xab');

            // check log
            await expectEvent.inLogs(receipt.logs, 'BET');

        })
    })

    describe('bet and distribute', function(){
        describe('when the answer is checkable', function(){
            it('should give user the pot when the answer matches', async() => {
                await lottery.setAnswerForTest(
                    '0xab6274dd5d9b5b5c7f665bc2b4b7b5919654c09ba21ef4c6a268424cf89219f3', 
                    {from : deployer}
                    );

                // betAndDistribute
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 2 -> 5

                await lottery.betAndDistribute('0xab', {from: user1, value: betAmount}); // 3 -> 6
                
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 6 -> 9


                let potBefore = await lottery.getPot(); // 0.01 eth
                let user1BalanceBefore = await web3.eth.getBalance(user1); 
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 7 -> 10 : 정답 확인 가능(user1 pot 전달)
                
                let potAfter = await lottery.getPot(); // 0 
                let user1BalanceAfter = await web3.eth.getBalance(user1); // before + 0.015 eth 

                // check pot changed
                // console.log(potBefore.toString()); 
                // console.log(betAmountBN.toString());
                assert.equal(potBefore.toString(), new web3.utils.BN('10000000000000000').toString());
                assert.equal(potAfter.toString(), new web3.utils.BN('0').toString());

                // user balance 확인 
                // console.log(user1BalanceBefore);
                // console.log(user1BalanceAfter);
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore);
                assert.equal(
                    user1BalanceBefore.add(potBefore).add(betAmountBN).toString()
                    , new web3.utils.BN(user1BalanceAfter).toString()
                    );
            })

            it('should return the bet amount when only one character matches', async() => {
                await lottery.setAnswerForTest(
                    '0xab6274dd5d9b5b5c7f665bc2b4b7b5919654c09ba21ef4c6a268424cf89219f3', 
                    {from : deployer}
                    );

                // betAndDistribute
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 2 -> 5

                await lottery.betAndDistribute('0xaf', {from: user1, value: betAmount}); // 3 -> 6
                
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 6 -> 9


                let potBefore = await lottery.getPot(); // 0.01 eth
                let user1BalanceBefore = await web3.eth.getBalance(user1); 
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 7 -> 10 : 정답 확인 가능(user1 pot 전달)
                
                let potAfter = await lottery.getPot(); // 0.01 eth
                let user1BalanceAfter = await web3.eth.getBalance(user1); // before + 0.005 eth

                // check pot changed
                assert.equal(potBefore.toString(), potAfter.toString());

                // user balance 확인 
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore);
                assert.equal(
                    user1BalanceBefore.add(betAmountBN).toString()
                    , new web3.utils.BN(user1BalanceAfter).toString()
                    );
            })

            it('should add bet amount to the pot when the challenge failed', async() => {
                await lottery.setAnswerForTest(
                    '0xab6274dd5d9b5b5c7f665bc2b4b7b5919654c09ba21ef4c6a268424cf89219f3', 
                    {from : deployer}
                    );

                // betAndDistribute
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 1 -> 4
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 2 -> 5

                await lottery.betAndDistribute('0xef', {from: user1, value: betAmount}); // 3 -> 6
                
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 4 -> 7
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 5 -> 8
                await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 6 -> 9


                let potBefore = await lottery.getPot(); // 0.01 eth
                let user1BalanceBefore = await web3.eth.getBalance(user1); 
                
                let receipt7 = await lottery.betAndDistribute('0xef', {from: user2, value: betAmount}); // 7 -> 10 : 정답 확인 가능(user1 pot 전달)
                
                let potAfter = await lottery.getPot(); // 0.015 eth
                let user1BalanceAfter = await web3.eth.getBalance(user1); // before

                // check pot changed
                assert.equal(potBefore.add(betAmountBN).toString(), potAfter.toString());

                // user balance 확인 
                user1BalanceBefore = new web3.utils.BN(user1BalanceBefore);
                assert.equal(
                    user1BalanceBefore.toString()
                    , new web3.utils.BN(user1BalanceAfter).toString()
                    );
            })
        })

        describe('when the blockhash has not revealed(Not mined)', function() {
            it('Check Not Revealed', async() => {
                let receipt = await lottery.betAndDistribute('0xef', {from: user1, value: betAmount}); // 1 -> 4
                assert.equal(receipt.logs[1].event, 'NOT_REVEALED');
            })
        })

        describe.only('when the block limit passed', function() {
            it('Check block limit passsed', async() => {
                var step; 
                for(step=0; step<=500; step++) {
                    await lottery.setAnswerForTest(
                        '0xab6274dd5d9b5b5c7f665bc2b4b7b5919654c09ba21ef4c6a268424cf89219f3', 
                        {from : deployer}
                        );
                }
                let receipt = await lottery.betAndDistribute('0xef', {from: user1, value: betAmount}); 
                console.log(receipt);
            })

        })

    })

    describe('isMatch', function() { 
        let blockHash = '0xab6274dd5d9b5b5c7f665bc2b4b7b5919654c09ba21ef4c6a268424cf89219f3';
        it('should be BettingResult.Win when two characters are equal', async() =>{
            let matchResult = await lottery.isMatch('0xab', blockHash);
            assert.equal(matchResult, 1);
        })

        it('should be BettingResult.Draw when one characters are equal', async() =>{
            let matchResult = await lottery.isMatch('0xac', blockHash);
            assert.equal(matchResult, 2);
        })

        it('should be BettingResult.Fail when no characters are equal', async() =>{
            let matchResult = await lottery.isMatch('0xcd', blockHash);
            assert.equal(matchResult, 0);
        })
    })

});