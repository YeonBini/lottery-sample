module.exports = async (promise) => {
    try {
        await promise;
        assert.fail('Expected revert not received');
    } catch(error) {
        const revertFound = error.message.search('Not enough') >=0; 
        assert(revertFound, `Expected "Not enough", got ${error} instead`)
    }
}