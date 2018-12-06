App = {
    web3Provider: null,
    contracts: {},
    api: null,
    tabs: ['TradeCenter', 'BreedCenter', 'ComputeCenter', 'Me'],
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
            App.config.defaultBreedCenterThingsNum = data.default_breed_center_things_num;
            App.config.defaultComputeCenterThingsNum = data.default_breed_center_things_num;
            App.config.defaultUsersThingsNum = data.default_users_things_num;
            App.config.defaultTradeCenterAccount = data.default_accounts.trade_center;
            App.config.defaultBreedCenterAccount = data.default_accounts.breed_center;
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
                    switch (result.args._from) {
                        case App.config.defaultTradeCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[0]);
                            break;
                        case App.config.defaultBreedCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[1]);
                            break;
                        case App.config.defaultComputeCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[2]);
                            break;
                        default:
                            App.loadThing(result.args.thingId, App.tabs[3]);
                            break;
                    }
                } else {
                    console.log('NewThing error: ' + error.message);
                }
            });
            // ERC721 Transfer事件
            App.api.Transfer().watch(function (error, result) {
                if (!error) {
                    console.log('Transfer: ' + JSON.stringify(result));
                    App.updateBalance();
                    switch (result.args._from) {
                        case App.config.defaultTradeCenterAccount:
                            App.removeThing(result.args._tokenId, App.tabs[0]);
                            break;
                        case App.config.defaultBreedCenterAccount:
                            App.removeThing(result.args._tokenId, App.tabs[1]);
                            break;
                        case App.config.defaultComputeCenterAccount:
                            App.removeThing(result.args._tokenId, App.tabs[2]);
                            break;
                        default:
                            App.removeThing(result.args._tokenId, App.tabs[3]);
                            break;
                    }
                    switch (result.args._to) {
                        case App.config.defaultTradeCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[0]);
                            break;
                        case App.config.defaultBreedCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[1]);
                            break;
                        case App.config.defaultComputeCenterAccount:
                            App.loadThing(result.args.thingId, App.tabs[2]);
                            break;
                        default:
                            App.loadThing(result.args.thingId, App.tabs[3]);
                            break;
                    }
                } else {
                    console.log('Transfer error: ' + error.message);
                }
            });
            App.initAccount();
            App.initThingFactory(App.config.defaultTradeCenterAccount, App.config.defaultTradeCenterThingsNum);
            App.initThingFactory(App.config.defaultBreedCenterAccount, App.config.defaultBreedCenterThingsNum);
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
        $('#play-hint').text("玩法：（1）点击购买宠物（2）数据入链后交易才完成（3）在“我的“中查看已购宠物").show();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(App.config.defaultTradeCenterAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[0]);
            }
        }).catch(function (err) {
            console.log('handleTradeCenter error: ' + err.message);
        });
    },

    // 繁育中心
    handleBreedCenter: function () {
        App.currentTab = App.tabs[1];
        $('#play-hint').text("玩法：（1）在希望交配的宠物下输入我的宠物ID（2）点击选TA（3）数据入链后，交配产生的新宠物在“我的“中查看").show();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(App.config.defaultBreedCenterAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[1]);
            }
        }).catch(function (err) {
            console.log('handleBreedCenter error: ' + err.message);
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
                App.loadThing(thingIds[i], App.tabs[2]);
            }
        }).catch(function (err) {
            console.log('handleBreedCenter error: ' + err.message);
        });
    },


    // 我的
    handleMyCenter: function () {
        App.currentTab = App.tabs[3];
        $('#play-hint').hide();
        $('#thingsRow').empty();
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThingsByOwner(App.currentAccount);
        }).then(function (thingIds) {
            for (let i = 0; i < thingIds.length; i++) {
                App.loadThing(thingIds[i], App.tabs[5]);
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
    },

    // 购买
    handleBuyThing: function () {
        if (parseInt($(this).attr('thing-price')) > App.currentAccountBalance) {
            alert("当前账户余额不足");
        }
        let thingId = $(this).attr('thing-id');
        let thingPrice = $(this).attr('thing-price');
        $("[thing-item-id="+thingId+"]").find('.btn-buy').text('购买中').attr('disabled', true);
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

    // 繁育
    handleBreed: function () {
        let targetThingId = $(this).attr('thing-id');
        let myId = $("[thing-item-id="+targetThingId+"]").find('.my-id').val();
        if (myId === "") {
            alert("请输入你的宠物ID");
            return;
        }
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThing(parseInt(myId));
        }).then(function (thing) {
            let readyTime = thing[4];
            let timestamp = new Date().getTime() / 1000;
            if (timestamp >= readyTime) {
                $("[thing-item-id="+targetThingId+"]").find('.btn-breed').text('交配中').attr('disabled', true);
                App.contracts.ThingCore.deployed().then(function (instance) {
                    if (App.config.debug) {
                        console.log(App.currentAccount + ' bread thing, targetThingId: ' + targetThingId + ", myId: " + myId);
                    }
                    return instance.breed(parseInt(myId), parseInt(targetThingId), {from: App.currentAccount,gas: 1000000000});
                }).then(function (result) {
                    if (App.config.debug) {
                        console.log('handleBreed result = ' + JSON.stringify(result));
                    }
                    $("[thing-item-id="+targetThingId+"]").find('.btn-breed').text('选TA').attr('disabled', false);
                    alert("繁育完成，请在“我的”中查看结果。")
                }).catch(function (err) {
                    console.log(err.message);
                });
            } else {
                alert("宠物还在冷却中，请换个")
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
            alert("请输入你的宠物ID");
            return;
        }
        App.contracts.ThingCore.deployed().then(function (instance) {
            return instance.getThing(parseInt(myId));
        }).then(function (thing) {
            console.log("in compute center");
        }).catch(function (err) {
            console.log(err.message);
        });
    },

    // 出售
    handleSellThing: function () {
        $(this).text('出售中').attr('disabled', true);
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
        $('#breed-center').on('click', App.handleBreedCenter);
        $('#compute-center').on('click', App.handleComputeCenter);
        $('#my-center').on('click', App.handleMyCenter);

        $(document).on('click', '.btn-buy', App.handleBuyThing);
        $(document).on('click', '.btn-sell', App.handleSellThing);
        $(document).on('click', '.btn-breed', App.handleBreed);
        $(document).on('click', '.btn-compute', App.handleCompute);
    },

    updateBalance: function () {
        let balance = web3.fromWei(web3.eth.getBalance(App.currentAccount), "ether");
        App.currentAccountBalance = balance;
        $('#account-balance').text(balance + " ETH");
    },

    generateAttr: function (dna) {

        let dnaStr = String(dna);
        // 如果dna少于16位,在它前面用0补上
        while (dnaStr.length < 16) {
            dnaStr = "0" + dnaStr;
        }
        return {
            // 前两位数构成头部.我们可能有7种头部, 所以 % 7
            // 得到的数在0-6,再加上1,数的范围变成1-7
            // 通过这样计算：
            headChoice: dnaStr.substring(0, 2) % 7 + 1,
            // 我们得到的图片名称从head1.png 到 head7.png

            // 接下来的两位数构成眼睛, 眼睛变化就对11取模:
            eyeChoice: dnaStr.substring(2, 4) % 11 + 1,
            // 再接下来的两位数构成衣服，衣服变化就对6取模:
            skinChoice: dnaStr.substring(4, 6) % 6 + 1,

            upChoice: dnaStr.substring(6, 8),
            downChoice: dnaStr.substring(8, 10),
        }

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
            let price = thing[1];
            let dna = thing[2];
            let readyTime = thing[3];
            let generation = thing[4];
            let url = App.config.imgUrl + (thing[2] % App.config.imgCount);
            if (App.config.debug) {
                console.log("Image res: " + url);
            }
            $.get(url, function(data) {
                console.log(JSON.stringify(thing));
                let thingsRow = $('#thingsRow');
                let thingTemplate = $('#thing-template');
                thingTemplate.find('.thing-template-body').addClass('thing-item');
                thingTemplate.find('.thing-template-body').attr('thing-item-id', thingId);
                thingTemplate.find('.panel-title').text("名字：" + name);
                thingTemplate.find('img').attr('src', data.image_url);
                thingTemplate.find('.thing-id').text(thingId);
                thingTemplate.find('.thing-price').text(price);
                thingTemplate.find('.thing-generation').text(generation);
                let timestamp=new Date().getTime() / 1000;
                if (timestamp >= readyTime) {
                    thingTemplate.find('.thing-ready-time').text(0);
                } else {
                    thingTemplate.find('.thing-ready-time').text(parseInt((readyTime - timestamp) / 60));
                }
                let attr = App.generateAttr(thing[2]);
                thingTemplate.find('.thing-head').text(attr.headChoice);
                thingTemplate.find('.thing-eye').text(attr.eyeChoice);
                thingTemplate.find('.thing-skin').text(attr.skinChoice);
                thingTemplate.find('.thing-up').text(attr.upChoice);
                thingTemplate.find('.thing-down').text(attr.downChoice);
                thingTemplate.find('.btn-buy').attr('thing-id', thingId);
                thingTemplate.find('.btn-buy').attr('thing-price', price);
                thingTemplate.find('.btn-sell').attr('thing-id', thingId);
                thingTemplate.find('.btn-sell').attr('thing-price', price);
                thingTemplate.find('.btn-upgrade').attr('thing-id', thingId);
                thingTemplate.find('.btn-breed').attr('thing-id', thingId);
                thingTemplate.find('.btn-compute').attr('thing-id', thingId);
                if (App.currentTab !== targetTab) {
                    return;
                }
                switch (App.currentTab) {
                    case App.tabs[0]:
                        thingTemplate.find('.btn-buy').show();
                        thingTemplate.find('.btn-sell').hide();
                        thingTemplate.find('.btn-breed').hide();
                        thingTemplate.find('.btn-compute').hide();
                        thingTemplate.find('.my-id').hide();
                        thingTemplate.find('.kitty-id').hide();
                        break;
                    case App.tabs[1]:
                        thingTemplate.find('.btn-buy').hide();
                        thingTemplate.find('.btn-sell').hide();
                        thingTemplate.find('.btn-breed').show();
                        thingTemplate.find('.btn-compute').hide();
                        thingTemplate.find('.my-id').show();
                        thingTemplate.find('.kitty-id').hide();
                        break;
                    case App.tabs[2]:
                        thingTemplate.find('.btn-bug').hide();
                        thingTemplate.find('.btn-sell').hide();
                        thingTemplate.find('.btn-breed').hide();
                        thingTemplate.find('.btn-compute').show();
                        thingTemplate.find('.my-id').hide();
                        thingTemplate.find('.kitty-id').hide();
                        break;
                    case App.tabs[3]:
                        thingTemplate.find('.btn-bug').hide();
                        thingTemplate.find('.btn-sell').hide();
                        thingTemplate.find('.btn-breed').hide();
                        thingTemplate.find('.btn-compute').hide();
                        thingTemplate.find('.my-id').show();
                        thingTemplate.find('.kitty-id').hide();
                        break;
                }
                thingsRow.append(thingTemplate.html());
            });
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
