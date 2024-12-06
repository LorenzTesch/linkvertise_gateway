
// libs
const express = require("express");
const app = express();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
// libs-end

// custom imports
const Link = require('./linkObj.js');
const CustomText = require('../text.json');
const CONFIG = require('../config.json');

// global object
const activeLinks = {};


// core util
const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');



function shortenLinkLinkvertise(checkoutKey, turns){

    // random padding to avoid duplicates
    var linkname = genRanHex(8);

    // build the return url, to which the user is redirect after completing the linkvertise task
    var target = Buffer.from(`${CONFIG.host}${CONFIG.path}${checkoutKey}`).toString('base64');

    if(CONFIG.linktype === "dynamic"){

        const btoa = (str) => {
            return Buffer.from(str).toString('base64');
        }

        let user_id = CONFIG.user.id;
        let url = "https://link-to.net/" + user_id + "/" + Math.random() * 1000 + "/dynamic/?r=" + btoa(encodeURI(target));

        return url;

    }else{
        
        const token = CONFIG.user.token;

        // TODO: this http body will need to be updated from time to time
        const details = {
            "operationName": "createLink",
            "variables": {
                "input": {
                    "seo_faq_ids": [],
                    "available_ads": "ALL",
                    "target_type": "URL",
                    "target": target,
                    "paywall_weight": 0.6,
                    "btn_prefix": "zu",
                    "btn_text": `${CONFIG.turns-turns} of ${CONFIG.turns} ` + linkname,
                    "seo_active": false,
                    "title": null,
                    "description": null,
                    "video_url": null,
                    "images": [],
                    "require_addon": true,
                    "require_web": true,
                    "require_installer": true,
                    "require_og_ads": true,
                    "require_custom_ad_step": true
                }
            },
            "query": "mutation createLink($input: LinkInput!) {\n  createLink(input: $input) {\n    id\n    href\n    user_id\n    __typename\n  }\n}\n"
        };

        // send standard browser headers
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Referer': 'https://link-mutation.linkvertise.com/',
            'Authorization': token,
            'Content-Type': 'application/json',
            'Origin': 'https://link-mutation.linkvertise.com',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Priority': 'u=1',
            'TE': 'trailers'
        };

        return new Promise(async(resolve, reject)=>{

            var res = await fetch('https://publisher.linkvertise.com/graphql', {
                method: 'POST',
                headers,
                body: JSON.stringify(details)
            });

            var body = await res.text();

            var json = JSON.parse(body);

            // extract the href returned from the api call to linkvertise
            resolve(json.data.createLink.href);            
        });

    }
  

}

function removeOldLinks(){

    var ts = Date.now();

    for(key in Object.keys(activeLinks)){

        if(activeLinks[key].expire < ts){
            delete activeLinks[key];
        }

    }

}

async function addLink(turns, userid){

    var checkoutKey = genRanHex(32);

    activeLinks[checkoutKey] = new Link(userid);

    try{
        var url = await shortenLinkLinkvertise(checkoutKey, turns);
    }catch(e){
        console.log(e);
    }

    if(!url){
        url = await addLink(turns, userid);
    }

    return url;

}





// http server


// set header for all responses
app.use((req, res, next)=>{

    res.set('Referrer-Policy', 'no-referrer');

    next();

});


// this is the entry point. redirect a user here to start the task-process
app.get(CONFIG.path + 'create/:uid', async(req, res)=>{

    // uid should be a unique user or transaction identifier
    var uid = parseInt(req.params.uid);

    // maybe implement regex or DB call, to check if parameter "uid" is valid
    if(isNaN(uid)){
        res.send('Invalid uid.')
    }else{ // assumes uid is correct
        
        var url = await addLink(CONFIG.turns-1, uid);

        console.log(activeLinks);

        res.redirect(url);

    }

});


// users are automatically redirected here after completing a task on linkvertise.
app.get(CONFIG.path + ':checkoutKey', async(req, res)=>{

    console.log(activeLinks);

    var checkoutKey = req.params.checkoutKey;

    console.log('checkoutKey', checkoutKey);

    var linkInfo = activeLinks[checkoutKey];

    if(!linkInfo){
        return res.send(CustomText.link_expired);
    }

    var turnsLeft = linkInfo.turns;

    if(turnsLeft > 0){

        var url = await addLink(turnsLeft - 1, linkInfo.userid);

        res.redirect(url);

    }else{

        // user completed required amount of tasks, now execute callback

        const redirect = (url) => {
            res.redirect(url);
        }

        SuccessCallback(linkInfo.userid, redirect);

    }

    // remove + disable link
    delete activeLinks[checkoutKey];

});

var SuccessCallback = null;


// initialize instance
module.exports = (PORT, _SuccessCallback) => {
    SuccessCallback = _SuccessCallback;
    app.listen(PORT);

    setInterval(removeOldLinks, 86400000); // run every day

    return app;
}



