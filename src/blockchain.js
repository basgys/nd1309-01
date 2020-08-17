/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

const messageTTLinSeconds = 5 * 60;

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.indexHashToHeight = {};        // index: block hash => block height
        this.indexAddressToHeights = {};    // index: wallet address => [block heights]
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (!this.height) {
            const genesis = new BlockClass.Block({});
            await this._addBlock(genesis);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, _) => {
            resolve(this.chain.length);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    _addBlock(block) {
        const self = this;
        return new Promise(async (resolve, _) => {
            // Block height
            block.height = await self.getChainHeight();
            // UTC timestamp
            block.time = new Date().getTime().toString().slice(0,-3);
            // Previous block hash
            if (block.height > 0) {
                const previousBlock = await self.getBlockByHeight(block.height - 1);
                block.previousBlockHash = previousBlock.hash;
            }
            // Ensure hash is empty
            block.hash = '';
            // Block hash with SHA256 using block and converting to a string
            block.hash = SHA256(JSON.stringify(block)).toString();

            // Adding block object to chain and update indices
            self.chain.push(block);
            self.indexHashToHeight[block.hash] = block.height;

            // Resolve promise with newly-added block
            resolve(block);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            const currentTime = new Date().getTime().toString().slice(0,-3);
            resolve(`${address}:${currentTime}:starRegistry`);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
    submitStar(address, message, signature, star) {
        const self = this;
        return new Promise(async (resolve, reject) => {
            // * 1. Validate parameters
            const messageParts = message.split(':');
            if (messageParts.length !== 3 || messageParts[2] !== 'starRegistry') {
                reject('malformed message (expected format: <walled address>:<time>:starRegistry');
                return
            }
            const messageAddress = messageParts[0];
            if (messageAddress !== address) {
                reject('message address does not match given address');
                return
            }
            const messageTime = parseInt(messageParts[1]);
            if (!messageTime) {
                reject('message time is invalid');
                return
            }

            // * 2. Get the current time
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

            // * 3. Check if the time elapsed is less than 5 minutes
            // Note:
            // When the wall clock goes backward, we have a negative time diff, but let's pretend it won't happen 🕐
            const timeDiff = currentTime - messageTime;
            if (timeDiff >= messageTTLinSeconds) {
                reject('star can no longer be validated with this message. Please request a new ownership verification message.');
                return
            }

            // * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
            if (!bitcoinMessage.verify(message, address, signature)) {
                reject('message verification failed');
                return
            }

            // * 5. Create the block and add it to the chain
            // Add block to the chain
            const block = await self._addBlock(new BlockClass.Block(star));
            // Add block height to address index
            if (self.indexAddressToHeights[address]) {
                self.indexAddressToHeights[address].push(block.height);
            } else {
                self.indexAddressToHeights[address] = [block.height];
            }

            // * 6. Resolve with the block added.
            resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
    getBlockByHash(hash) {
        // From O(n) to O(1) \o/
        return this.getBlockByHeight(self.indexHashToHeight[hash]);
    }

    /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     */
    getBlockByHeight(height) {
        const self = this;
        return new Promise((resolve, _) => {
            if (height >= 0 && height < self.chain.length) {
                resolve(self.chain[height]);
                return
            }
            resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
    getStarsByWalletAddress (address) {
        const self = this;
        return new Promise(async (resolve, _) => {
            // Get block heights from index
            const heights = self.indexAddressToHeights[address] || [];
            // Get star object for each block
            const stars = await Promise.all(heights.map(async (h) => {
                const block = await self.getBlockByHeight(h);
                const star = await block.getBData();
                return star;
            }));
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with a Boolean that
     * contains true when the given block is valid or false when it is not.
     */
    validateBlock(blockHeight){
        const self = this;
        return new Promise(async (resolve, _) => {
            // get block object
            const block = await self.getBlockByHeight(blockHeight);
            // check whether block is valid
            const isValid = await block.validate();
            // resolve promise
            resolve(isValid);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        const self = this;
        return new Promise(async (resolve, _) => {
            const errorLog = [];
            const previousBlockHash = null;
            for (var i = 0; i < self.chain.length-1; i++) {
                const block = await self.getBlockByHeight(i);
                // Ensure block is valid
                const isValid = await block.validate();
                if (!isValid) {
                    errorLog.push(`block #${i} is invalid`);
                }
                // Ensure chain is valid
                if (block.previousBlockHash !== previousBlockHash) {
                    errorLog.push(`chain broke at block #${i}`);
                }
                previousBlockHash = block.hash;
            }
            resolve(errorLog)
        });
    }

}

module.exports.Blockchain = Blockchain;