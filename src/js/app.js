App = {
    web3Provider: null,
    contracts: {},
    api: null,
    tabs: ['TradeCenter', 'ComputeCenter', 'Me'],
    currentTab: null,
    config: {},
    currentAccount: null,
    currentAccountBalance: 0,

    init: function () {
        // 初始化配置
        $.getJSON('../config.json', function (data) {
            // read from config.json
            App.config.debug = data.debug;
            App.config.dappName = data.dapp_name;
            App.config.rpc = data.rpc;
            App.config.networkId = data.network_id;
            App.config.imgUrl = data.img_url;
            App.config.imgCount = data.img_count;
            App.config.defaultTradeCenterThingsNum = data.default_trade_center_things_num;
            App.config.defaultComputeCenterThingsNum = data.default_breed_center_things_num;
            App.config.defaultUsersThingsNum = data.default_users_things_num;
            App.config.defaultTradeCenterAccount = data.default_accounts.trade_center;
            App.config.defaultComputeCenterAccount = data.default_accounts.breed_center;
            App.config.defaultUsersAccount = data.default_accounts.users;

            // init global var
            App.currentAccount = data.default_accounts.users[0];
            $('#current-account').text(App.currentAccount);
            App.currentTab = App.tabs[0];
        }).then(function () {
            App.initWeb3();
        });
    },

    // 初始化Web3
    initWeb3: function () {
        App.web3Provider = new Web3.providers.HttpProvider(App.config.rpc);
        web3 = new Web3(App.web3Provider);
        return App.initContract();
    },

    // 初始化合约相关
    initContract: function () {
        $.getJSON('../build/contracts/ThingCore.json', function (data) {
            if (App.config.debug) {
                console.log('Contract abi: ' + JSON.stringify(data.abi));
                console.log('Contract networks: ' + JSON.stringify(data.networks));
            }
            // Get the necessary contract artifact file and instantiate it with truffle-contract
            App.contracts.ThingCore = TruffleContract(data);
            // Set network id
            App.contracts.ThingCore.setNetwork(App.config.networkId);
            // Set the provider for our contract
            App.contracts.ThingCore.setProvider(App.web3Provider);
            App.api = web3.eth.contract(App.contracts.ThingCore.abi).at(App.contracts.ThingCore.address);
            // Log Event
            App.api.LogStatus().watch(function (error, result) {
                if (!error) {
                    console.log('LogStatus: ' + JSON.stringify(result.args.log));
                } else {
                    console.log('LogStatus error: ' + error.message);
                }
            });
            // ThingFactory的NewThing事件
            App.api.NewThing().watch(function (error, result) {
                if (!error) {
                    console.log('NewThing: ' + JSON.stringify(result));
                    App.loadThing(result.args.thingId, App.tabs[0]);
                } else {
                    console.log('NewThing error: ' + error.message);
                }
            });
            // ERC721 Transfer事件
            App.api.Transfer().watch(function (error, result) {
                if (!error) {
                    console.log('Transfer: ' + JSON.stringify(result));
                    App.updateBalance();
                    $("[thing-item-id="+result.args._tokenId+"]").find('.btn-buy').
                        text('Buy').attr('disabled', false);
                    App.loadThing(result.args._tokenId, App.tabs[0]);
                } else {
                    console.log('Transfer error: ' + error.message);
                }
            });
            App.initAccount();
            App.initThingFactory(App.config.defaultTradeCenterAccount, App.config.defaultTradeCenterThingsNum);
            App.initThingFactory(App.config.defaultComputeCenterAccount, App.config.defaultComputeCenterThingsNum);
            for (let i = 0; i < App.config.defaultUsersAccount.length; i++) {
                App.initThingFactory(App.config.defaultUsersAccount[i], App.config.defaultUsersThingsNum);
            }
            // Update UI
            return App.handleTradeCenter();
        });

        return App.bindEvents();
    },

    // 初始化帐号相关
    initAccount: function () {
        let menuRow = $('#menuRow');
        let li;
        for (let i = 0; i < App.config.defaultUsersAccount.length; i++) {
            if (li) {
                li = li + ` <li class="menu-template" role="presentation">
                    <a class="menu-item" role="menuitem">${App.config.defaultUsersAccount[i]}</a>
                </li>`;
            } else {
                li = ` <li class="menu-template" role="presentation">
                    <a class="menu-item" role="menuitem">${App.config.defaultUsersAccount[i]}</a>
                </li>`;
            }
        }
        menuRow.append(li);
        // 更新帐号余额
        App.updateBalance();
    },

    // 初始化帐号的产品，写入区块链
    initThingFactory: function (account, num) {
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(account);
        }).then(function (result) {
            if (result.length < num) {
                for (let i = 0; i < (num - result.length); i++) {
                    App.api.createRandomThing(Math.random().toString(36).substr(2),
                        parseInt(num), {from: account, gas: 100000000});
                }
            }
            console.log('initThingFactory for ' + account);
        }).catch(function (err) {
            console.log('initThingFactory error, account: ' + account + ", num: " + num
                + ", error: " + err.message);
        });
    },

    // 交易大厅
    handleTradeCenter: function () {
        App.currentTab = App.tabs[0];
        $('#play-hint').text("").show();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsCouldBuy(App.currentAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[0]);
            }
        }).catch(function (err) {
            console.log('handleTradeCenter error: ' + err.message);
        });
    },

    // Compute Center
    handleComputeCenter: function () {
        App.currentTab = App.tabs[1];
        $('#play-hint').text("select an algorithm to compute thing to a new thing").show();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(App.config.defaultComputeCenterAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[1]);
            }
        }).catch(function (err) {
            console.log('handleComputeCenter error: ' + err.message);
        });
    },


    handleMyCenter: function () {
        App.currentTab = App.tabs[2];
        $('#play-hint').hide();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(App.currentAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[2]);
            }
        }).catch(function (err) {
            console.log('updateUIInTradeCenter error: ' + err.message);
        });
    },

    handleChangeAccount: function () {
        console.log("handleChangeAccount");
        App.currentAccount = $(this).html();
        console.log("handleChangeAccount text: " + $(this).html());
        $('#current-account').text(App.currentAccount);
        App.updateBalance();

        switch (App.currentTab) {
            case App.tabs[0]:
                App.handleMyCenter();
                break;
            case App.tabs[1]:
                App.handleComputeCenter();
                break;
            case App.tabs[2]:
                handleMyCenter();
                break;
        }
    },

    // 购买
    handleBuyThing: function () {
        if (parseInt($(this).attr('thing-price')) > App.currentAccountBalance) {
            alert("Not Enough Balance of Current Account");
        }
        let thingId = $(this).attr('thing-id');
        let thingPrice = $(this).attr('thing-price');
        $("[thing-item-id="+thingId+"]").find('.btn-buy').text('Buying...').attr('disabled', true);
        App.contracts.ThingCore.deployed().then(function (instance) {
            if (App.config.debug) {
                console.log(App.currentAccount + ' buy thing, thingId: ' + thingId + ", thingPrice: " + thingPrice);
            }
            web3.eth.sendTransaction({from: App.currentAccount, to: App.config.defaultTradeCenterAccount,
                value:web3.toWei(thingPrice,'ether')});
            return instance.buyThing(thingId, {from: App.currentAccount});
        }).then(function (result) {
            if (App.config.debug) {
                console.log('handleBuyThing result = ' + JSON.stringify(result));
            }
        }).catch(function (err) {
            console.log(err.message);
        });
    },

    // Compute
    handleCompute: function () {
        let targetThingId = $(this).attr('thing-id');
        let myId = $("[thing-item-id="+targetThingId+"]").find('.my-id').val();
        if (myId === "") {
            alert("Input Your Thing ID");
            return;
        }
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.compute(parseInt(myId), "func", "url", {from: App.currentAccount,gas: 1000000000});
        }).catch(function (err) {
            console.log(err.message);
        });
    },

    // 出售
    handleSellThing: function () {
        $(this).text('Selling').attr('disabled', true);
        let thingId = $(this).attr('thing-id');
        let thingPrice = $(this).attr('thing-price');
        App.contracts.ThingCore.deployed().then(function (instance) {
            if (App.config.debug) {
                console.log(App.currentAccount + ' sell thing, thingId: ' + thingId + ", thingPrice: " + thingPrice);
            }
            web3.eth.sendTransaction({from: App.config.defaultTradeCenterAccount, to: App.currentAccount,
                value:web3.toWei(thingPrice,'ether')});
            return instance.buyThing(thingId, {from: App.config.defaultTradeCenterAccount});
        }).then(function (result) {
            if (App.config.debug) {
                console.log('handleBuyThing result = ' + JSON.stringify(result));
            }
        }).catch(function (err) {
            console.log(err.message);
        });
    },

    bindEvents: function () {
        $(document).on('click', '.menu-item', App.handleChangeAccount);
        $('#trade-center').on('click', App.handleTradeCenter);
        $('#compute-center').on('click', App.handleComputeCenter);
        $('#my-center').on('click', App.handleMyCenter);

        $(document).on('click', '.btn-buy', App.handleBuyThing);
        $(document).on('click', '.btn-sell', App.handleSellThing);
        $(document).on('click', '.btn-compute', App.handleCompute);
    },

    updateBalance: function () {
        let balance = web3.fromWei(web3.eth.getBalance(App.currentAccount), "ether");
        App.currentAccountBalance = balance;
        $('#account-balance').text(balance + " ETH");
    },

    loadThing: function(thingId, targetTab) {
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThing(parseInt(thingId));
        }).then(function (thing) {
            if ($('#page-hint').is(':visible')) {
                $('#pageTitle').text(App.config.dappName);
                $('#page-hint').hide();
                $('#page-tabs').show();
                $('#page-head').show();
            }
            let name = thing[0];
            let ext_url = thing[1];
            let dna = thing[2];
            let parent_id = thing[3];
            let func_id = thing[4];
            let generation = thing[5];
            let price = thing[6];
            let on_sale = thing[7];
            let owner = thing[8];
            console.log(JSON.stringify(thing));
            let thingsRow = $('#thingsRow');
            let thingTemplate = $('#thing-template');
            thingTemplate.find('img').attr('src', 'img/item.jpg');
            thingTemplate.find('.thing-template-body').addClass('thing-item');
            thingTemplate.find('.thing-template-body').attr('thing-item-id', thingId);
            thingTemplate.find('.panel-title').text("Name: " + name);
            thingTemplate.find('.thing-id').text(thingId);
            thingTemplate.find('.thing-dna').text(dna);
            thingTemplate.find('.thing-url').text(ext_url);
            thingTemplate.find('.thing-parent').text(parent_id);
            thingTemplate.find('.thing-function').text(func_id);
            thingTemplate.find('.thing-generation').text(generation);
            thingTemplate.find('.thing-price').text(price);
            thingTemplate.find('.thing-owner').text(owner);
            if (on_sale == false) {
                thingTemplate.find('.btn-buy').attr('disabled', true);
            } else {
                thingTemplate.find('.btn-buy').text("Buy").attr('disabled', false);
            }
            thingTemplate.find('.btn-buy').attr('thing-id', thingId);
            thingTemplate.find('.btn-buy').attr('thing-price', price);
            thingTemplate.find('.btn-sell').attr('thing-id', thingId);
            thingTemplate.find('.btn-sell').attr('thing-price', price);
            thingTemplate.find('.btn-upgrade').attr('thing-id', thingId);
            thingTemplate.find('.btn-compute').attr('thing-id', thingId);
            if (App.currentTab !== targetTab) {
                return;
            }
            switch (App.currentTab) {
                case App.tabs[0]:
                    thingTemplate.find('.btn-buy').show();
                    thingTemplate.find('.btn-sell').hide();
                    thingTemplate.find('.btn-compute').hide();
                    thingTemplate.find('.my-id').hide();
                    break;
                case App.tabs[1]:
                    thingTemplate.find('.btn-buy').hide();
                    thingTemplate.find('.btn-sell').hide();
                    thingTemplate.find('.btn-compute').show();
                    thingTemplate.find('.my-id').show();
                    break;
                case App.tabs[2]:
                    thingTemplate.find('.btn-buy').hide();
                    thingTemplate.find('.btn-sell').show();
                    thingTemplate.find('.btn-compute').hide();
                    thingTemplate.find('.my-id').hide();
                    break;
            }
            thingsRow.append(thingTemplate.html());
        }).catch(function (err) {
            console.log('loadThing error: ' + err.message);
        });
    },
    
    removeThing: function (thingId, targetTab) {
        if (App.currentTab !== targetTab) {
            return;
        }
        $("[thing-item-id="+thingId+"]").remove();
    }

};

$(function () {
    $(window).load(function () {
        App.init();
    });
});
