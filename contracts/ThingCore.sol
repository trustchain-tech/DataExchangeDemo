pragma solidity ^0.4.19;

contract ERC721 {

    event Transfer(address indexed _from, address indexed _to, uint256 _tokenId);
    event Approval(address indexed _owner, address indexed _approved, uint256 _tokenId);

    function balanceOf(address _owner) public view returns (uint256 _balance);
    function ownerOf(uint256 _tokenId) public view returns (address _owner);
    function transfer(address _to, uint256 _tokenId) public;
    function approve(address _to, uint256 _tokenId) public;
    function takeOwnership(uint256 _tokenId) public;
}


library SafeMath {

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        assert(c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}


contract Ownable {

    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function Ownable() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

///
/// Below is Thing Contract
///

contract ThingFactory is Ownable {

    using SafeMath for uint256;

    event NewThing(address _from, uint thingId, string name, bytes32 dna);
    event LogStatus(address _from, string log);

    struct Thing {
        string name;       // thing[0]
        string ext_url;    // thing[1]
        bytes32 dna;       // thing[2]
        uint parent_id;    // thing[3]
        uint func_id;      // thing[4]
        uint generation;   // thing[5]
        uint price;        // thing[6]
        bool on_sale;      // thing[7]
    }

    Thing[] public things;

    // _tokenId <==> _owner
    mapping (uint => address) public thingToOwner;
    // _owner <==> _tokenCount
    mapping (address => uint) ownerThingCount;

    function _createThing(string _name, string _ext_url,
        uint _parent_id, uint _func_id, uint _generation) internal
    {
        require(msg.sender != address(0));

        // 配置默认产品
        Thing memory _thing;
        _thing.name = _name;
        _thing.ext_url = _ext_url;
        _thing.dna = _generateDna(_ext_url);
        _thing.parent_id = _parent_id;
        _thing.func_id = _func_id;
        _thing.generation = _generation;
        _thing.price = 5;
        _thing.on_sale = true;

        // 记录到区块链
        uint id = things.push(_thing) - 1;
        thingToOwner[id] = msg.sender;
        ownerThingCount[msg.sender]++;

        // 通知事件
        NewThing(msg.sender, id, _name, _thing.dna);
    }

    function _generateDna(string _str) internal pure returns (bytes32) {
        return keccak256(_str);
    }

    // 对外接口，用于生产产品
    function createRandomThing(string _name, uint _limit) public {
        require(ownerThingCount[msg.sender] <= _limit);
        _createThing(_name, _name, 0, 0, uint(0));
    }
}

/// Generate new thing
contract ThingCompute is ThingFactory {

    modifier onlyOwnerOf(uint _thingId) {
        require(msg.sender == thingToOwner[_thingId]);
        _;
    }

    function strConcat(string _a, string _b, string _c, string _d, string _e) internal pure returns (string){
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        bytes memory _bc = bytes(_c);
        bytes memory _bd = bytes(_d);
        bytes memory _be = bytes(_e);
        string memory abcde = new string(_ba.length + _bb.length + _bc.length + _bd.length + _be.length);
        bytes memory babcde = bytes(abcde);
        uint k = 0;
        for (uint i = 0; i < _ba.length; i++) babcde[k++] = _ba[i];
        for (i = 0; i < _bb.length; i++) babcde[k++] = _bb[i];
        for (i = 0; i < _bc.length; i++) babcde[k++] = _bc[i];
        for (i = 0; i < _bd.length; i++) babcde[k++] = _bd[i];
        for (i = 0; i < _be.length; i++) babcde[k++] = _be[i];
        return string(babcde);
    }

    function compute(uint _thingId, string func_name, string _targetUrl) public {
        Thing storage myThing = things[_thingId];
        // TODO func_name to func_id
        _createThing(strConcat("n",myThing.name, "", "", ""), _targetUrl, _thingId, 1, myThing.generation + 1);
    }
}

/// 辅助合约
contract ThingHelper is ThingCompute {

    function withdraw() external onlyOwner {
        owner.transfer(this.balance);
    }

    function getThingsByOwner(address _owner) external view returns(uint[]) {
        uint[] memory result = new uint[](ownerThingCount[_owner]);
        uint counter = 0;
        for (uint i = 0; i < things.length; i++) {
            if (thingToOwner[i] == _owner) {
                result[counter] = i;
                counter++;
            }
        }
        return result;
    }

    function getThingsCouldBuy(address _owner) external view returns(uint[]) {
        uint counter = 0;
        uint k = 0;
        for (uint i = 0; i < things.length; i++) {
            if (things[i].on_sale == true && thingToOwner[i] != _owner) {
                counter++;
            }
        }

        uint[] memory result = new uint[](counter);
        for (uint j = 0; j < things.length; j++) {
            if (things[j].on_sale == true && thingToOwner[j] != _owner) {
                result[k] = j;
                k++;
            }
        }
        return result;
    }

    function getThing(uint _thingId) public view returns (
        string name,
        string ext_url,
        bytes32 dna,
        uint parent_id,
        uint func_id,
        uint generation,
        uint price,
        bool on_sale,
        address owner) {
        Thing storage thing = things[_thingId];
        name = thing.name;
        ext_url = thing.ext_url;
        dna = thing.dna;
        parent_id = thing.parent_id;
        func_id = thing.func_id;
        generation = thing.generation;
        price = thing.price;
        on_sale = thing.on_sale;
        owner = thingToOwner[_thingId];
    }

    function setOnSale(uint _thingId, bool _on_sale) public onlyOwnerOf(_thingId) {
        Thing storage myThing = things[_thingId];
        myThing.on_sale = _on_sale;
    }
}

/// ERC721 Impl
contract ThingCore is ThingHelper, ERC721 {

    using SafeMath for uint256;

    mapping (uint => address) thingApprovals;

    // ERC721 impl
    function balanceOf(address _owner) public view returns (uint256 _balance) {
        return ownerThingCount[_owner];
    }

    // ERC721 impl
    function ownerOf(uint256 _tokenId) public view returns (address _owner) {
        return thingToOwner[_tokenId];
    }

    function _transfer(address _from, address _to, uint256 _tokenId) private {
        Thing storage thing = things[_tokenId];
        ownerThingCount[_to] = ownerThingCount[_to].add(1);
        ownerThingCount[_from] = ownerThingCount[_from].sub(1);
        thingToOwner[_tokenId] = _to;
        thing.on_sale = false;
        Transfer(_from, _to, _tokenId);
    }

    // ERC721 impl
    function transfer(address _to, uint256 _tokenId) public onlyOwnerOf(_tokenId) {
        _transfer(msg.sender, _to, _tokenId);
    }

    // ERC721 impl
    function approve(address _to, uint256 _tokenId) public onlyOwnerOf(_tokenId) {
        thingApprovals[_tokenId] = _to;
        Approval(msg.sender, _to, _tokenId);
    }

    // ERC721 impl
    function takeOwnership(uint256 _tokenId) public {
        require(thingApprovals[_tokenId] == msg.sender);
        address owner = ownerOf(_tokenId);
        _transfer(owner, msg.sender, _tokenId);
    }

    function buyThing(uint _thingId) public payable {
        require(things[_thingId].on_sale == true);
        address owner = thingToOwner[_thingId];
        _transfer(owner, msg.sender, _thingId);
    }
}
