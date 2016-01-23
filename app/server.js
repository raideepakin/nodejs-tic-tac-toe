
/**
 * server.js to handle real time server request and response
 */

var http = require('http');
var url = require('url');
var fs = require('fs');
var p = require('path');

// create the server here
var server = http.createServer(function(request, response) {

    var path = url.parse(request.url).pathname;
    var file_path = p.resolve(__dirname, '../') + path;
    switch (path) {

        case '/':
            response.writeHead(200, {'Content-Type': 'text/html'});
            response.write('Hello world !!!');
            response.end();
            break;
        default:
            fs.readFile(file_path, function(error, data) {
                if (error) {
                    response.writeHead(404);
                    response.write("Page Not found. (Error 404).");
                    response.end();
                }
                else {
                    if (request.url.indexOf('.html') !== -1) {

                        response.writeHead(200, {'Content-Type': 'text/html'});
                    } else if (request.url.indexOf('.css') !== -1) {

                        response.writeHead(200, {'Content-Type': 'text/css'});
                    } else if (request.url.indexOf('.js') !== -1) {

                        response.writeHead(200, {'Content-Type': 'text/javascript'});
                    }

                    response.end(data);
                }
            });
            break;
    }

});

//var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080;
//var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
//server.listen(server_port, server_ip_address, function() {
//    console.log('Server running at ' + server_ip_address + ':' + server_port);
//});

server.listen(process.env.PORT || 5000, function(){
  //console.log("Express server listening on port %d in %s mode", this.address().port, server.settings.env);
});

// stores online users count
online_count = 0;

// users name and playing status
users_pool = [];

// for matching the users for playing game
user_games = [];

// game timer
game_timer = [];

// socket io
var io = require('socket.io').listen(server);
io.set('log level', 1);
io.sockets.on('connection', function(socket) {

    // register the user when clicked on start playing button
    socket.on('start_playing', function(data) {

        // on register increase on the online count
        online_count++;
        // emit the online count to all the users
        io.sockets.emit('online_data', {
            'online_count': online_count
        });
        // set the users_pool with client socket id and playing status to 0
        users_pool[socket.id] = 0;
        // when a user click on start playing, find the opponent and start the game
        setOpponents();
    });
    /**
     * On disconnect
     * What happens when a user diconnects or closes the browser in between
     */
    socket.on('disconnect', function(data) {

        // delete the user
        if (users_pool[socket.id] == 0) {

            online_count--;
        } else if (users_pool[socket.id] == 1) {

            online_count = online_count - 2;
        }

        // client who disconnected and its opponent socket id's
        var client = socket.id;
        var opponent = user_games[client];
        // on disconnect remove the user from users pool
        delete users_pool[client];
        // if one user closes the window in between then send message to
        // its opponent that the other user has left and refresh its window.
        io.sockets.socket(opponent).emit('opponent_left', 1);
        // also remove from user_games array as well
        delete user_games[client];
        delete user_games[opponent];
        //also remove from users_pool
        delete users_pool[opponent];
        // emit the refreshed online count
        io.sockets.emit('online_data', {
            'online_count': online_count
        });
        // on disconnect stop that game timer
        stop_timer();
    });
    // recieve client data, actual game process goes here
    socket.on('client_data', function(data) {

        // get the socket id of the user who is sending the data
        // get its game parter from user_games array, if found then emit to that client
        var from = socket.id;
        var to = user_games[socket.id];
        var game_data = {
            'block': data.block,
            'masterBit': data.masterBit,
            'counter': data.counter,
            'turn': 1, // set turn to 1
            'sign': '0' // zero
        };
        io.sockets.socket(to).emit('server_data', game_data);
        game_data['turn'] = 0; // set turn to zero
        game_data['sign'] = 'X'; // cross

        io.sockets.socket(from).emit('server_data', game_data);
        // show hide over lay on the other side
        io.sockets.socket(to).emit('enable', 'enable');
        // run the timer after each player's turn
        timer();
        // check the result after every game data is received from either end
        check_result(game_data['block'], game_data['counter']);
    });
    /**
     * selected any two random players from the list of available users
     * and starts a new game from them
     */
    function setOpponents() {

        // get the count of users waiting
        var users_waiting = getUsersWaiting();
        // if number of users waiting for game >= 2 then assign the game
        if (users_waiting >= 2) {

            var max_two = 1;
            for (var socket_id in users_pool) {

                if (users_pool[socket_id] == 0) {

                    users_pool[socket_id] = 1;
                    if (max_two == 1) {

                        var user_1 = socket_id;
                    } else if (max_two == 2) {

                        var user_2 = socket_id;
                        break;
                    }

                    max_two++;
                }
            }

            // assign users to each other. TODO : refactor
            user_games[user_1] = user_2;
            user_games[user_2] = user_1;
        }

        // if client's socket id found in user_games then user has been
        // assigned with opponent and game can be started.
        if (user_games[socket.id]) {

            var from = socket.id;
            var to = user_games[socket.id];
            var start_data = {
                'turn': 0,
                'sign': 'X', // cross
                'masterBit': 1
            };
            io.sockets.socket(to).emit('start_game_data', start_data);
            start_data['turn'] = 1;
            start_data['sign'] = '0'; // zero
            start_data['masterBit'] = 0;
            io.sockets.socket(from).emit('start_game_data', start_data);
            // run the timer as soon as opponents are connected
            timer();
        }

    }


    /**
     * get the number of users waiting to get assigned to opponents
     */
    function getUsersWaiting() {

        // get the count of users waiting
        var users_waiting = 0;
        for (socket.id in users_pool) {

            if (users_pool[socket.id] == 0) {

                users_waiting++;
            }
        }

        return users_waiting;
    }

    // maintains the game timer for multiple games
    function timer() {

        var from = socket.id;
        var to = user_games[from];
        if (typeof game_timer[from] != 'undefined' && typeof game_timer[to] != 'undefined') {

            clearInterval(game_timer[from]);
            clearInterval(game_timer[to]);
        }

        var timer_data = {
            'counter': 15
        };
        
        game_timer[from] = game_timer[to] = setInterval(function() {

            io.sockets.socket(to).emit('timer', timer_data);
            io.sockets.socket(from).emit('timer', timer_data);
            if (timer_data['counter'] == 1) {

                clearInterval(game_timer[from]);
                clearInterval(game_timer[to]);
                timer_data['you_won'] = 0;
                timer_data['time_up'] = 1;
                timer_data['turn'] = 0;
                io.sockets.socket(to).emit('game_result', timer_data);
                timer_data['you_won'] = 1;
                timer_data['turn'] = 1;
                io.sockets.socket(from).emit('game_result', timer_data);
            }

            timer_data['counter']--;
        }, 1000);
    }

    function stop_timer() {

        var from = socket.id;
        var to = user_games[from];
        clearInterval(game_timer[from]);
        clearInterval(game_timer[to]);
    }


    /**
     * function called everytime a block is clicked to check the result
     * Not working properly
     */
    function check_result(block, counter) {
        var One = block.one;
        var Two = block.two;
        var Three = block.three;
        var Four = block.four;
        var Five = block.five;
        var Six = block.six;
        var Seven = block.seven;
        var Eight = block.eight;
        var Nine = block.nine;
        // X won, start new game with 'X' player
        if ((One == 1 && Two == 1 && Three == 1) || (Four == 1 && Five == 1 && Six == 1) ||
                (Seven == 1 && Eight == 1 && Nine == 1) || (One == 1 && Four == 1 && Seven == 1) ||
                (Two == 1 && Five == 1 && Eight == 1) || (Three == 1 && Six == 1 && Nine == 1) ||
                (One == 1 && Five == 1 && Nine == 1) || (Three == 1 && Five == 1 && Seven == 1)) {

            var from_user = socket.id;
            var to_user = user_games[socket.id];
            var result_data = {
                'you_won': 1,
                'turn': 1
            };
            io.sockets.socket(from_user).emit('game_result', result_data);
            
            result_data['you_won'] = 0;
            result_data['turn'] = 0;
            io.sockets.socket(to_user).emit('game_result', result_data);
            // stop timer after game is over
            stop_timer();
        }

        // 0 won, start the new game with '0' player
        if ((One == 0 && Two == 0 && Three == 0) || (Four == 0 && Five == 0 && Six == 0) ||
                (Seven == 0 && Eight == 0 && Nine == 0) || (One == 0 && Four == 0 && Seven == 0) ||
                (Two == 0 && Five == 0 && Eight == 0) || (Three == 0 && Six == 0 && Nine == 0) ||
                (One == 0 && Five == 0 && Nine == 0) || (Three == 0 && Five == 0 && Seven == 0)) {

            var from_user = socket.id;
            var to_user = user_games[socket.id];
            var result_data = {
                'you_won': 1,
                'turn': 1
            };
            io.sockets.socket(from_user).emit('game_result', result_data);
            result_data['you_won'] = 0;
            result_data['turn'] = 0;
            io.sockets.socket(to_user).emit('game_result', result_data);
            // stop timer after game is over
            stop_timer();
        }

        // game draw, start new game with the player who took second last chance
        if (counter == 9) {

            var from_user = socket.id;
            var to_user = user_games[socket.id];
            var result_data = {
                'you_won': -1, // game draw
                'turn': 0
            };
            io.sockets.socket(from_user).emit('game_result', result_data);
            result_data['you_won'] = -1; // game draw
            result_data['turn'] = 1;
            io.sockets.socket(to_user).emit('game_result', result_data);
            // stop timer after game is over
            stop_timer();
        }

    }

});

