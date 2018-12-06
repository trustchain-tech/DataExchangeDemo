module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 7545,
            from: "0x7Df93a3E6a08c3Eea13f6dd00FF134E47A134C6a",
            // gas: 4712388, // web3.eth.getBlock("pending").gasLimit
            network_id: "*"
        }
    }
};
