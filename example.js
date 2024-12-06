

function callback(uid, redirect){

    // make DB call for specified users
    console.log(`Users with uid "${uid}" completed the task!`);

    // redirect users to a thank you page or similiar
    redirect('https://google.com/search?q=success')

}


const port = 80;

// returns the express instance
const LinkGatewayServer = require('./lib')(port, callback);