const DAY_IN_MS = 86400000;

function Link(userid, turns){
    this.userid = userid;
    this.turns = turns;
    this.expire = Date.now() + DAY_IN_MS;
}

module.exports = Link;