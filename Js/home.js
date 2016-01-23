
// To establish socket connection from Client
var socket = io.connect();

// Game object
game = {
    block: {
        one: -1,
        two: -1,
        three: -1,
        four: -1,
        five: -1,
        six: -1,
        seven: -1,
        eight: -1,
        nine: -1
    },
    counter: 0,
    masterBit: 1,
    result: ''
};

$(document).ready(function() {

    // shows timer
    socket.on('timer', function(data) {

        $('#timer').html('Time left : ' + data.counter).show();
    });

    // data received from server
    socket.on('server_data', function(data) {

        game.block = data.block;
        game.masterBit = data.masterBit;
        game.counter = data.counter;

        // set the 0 or X based on block object
        for (var key in game.block) {

            // If block is empty tand has key not equal to -1 then change the content
            if ($('#' + key).html() == '') {
                if (game.block[key] === 0) {

                    $('#' + key).html("<img src='Image/mark_o.png' width='40' height'40' />");
                } else if (game.block[key] === 1) {

                    $('#' + key).html("<img src='Image/mark_x.png' width='40' height'40' />");
                }
            }
        }
        // sets the user turn
        set_turn(data);

    });

    // when game result is received
    socket.on('game_result', function(data) {

        $('.overlay').hide();

        if (data.you_won == 1) {

            game.result = 'You won';
        } else if (data.you_won == 0) {

            game.result = 'You Lose';
        } else if (data.you_won == -1) {

            game.result = 'Game draw';
        }

        // if game finished due to time up then show appropriate message
        if (typeof data.time_up != 'undefined') {

            game.result = 'Time up. ' + game.result;
        }

        // display the game result
        $('#messages').html(game.result).show();

        $('.block, #turn, #timer, #sign').html('');

        setTimeout(function() {

            // set the values
            set_values();
            set_turn(data);

            $('#messages').html('New game started');
            // show some message like starting new game
        }, 4000);

    });

    // to hide the overlay when players turn
    socket.on('enable', function(data) {

        $('.overlay').hide();
    });


    // show online count of users
    socket.on('online_data', function(data) {

        //$('#online_count').html(data.online_count);
    });


    // data setup when game starts
    socket.on('start_game_data', function(data) {

        game.masterBit = data.masterBit; // set master bit

        // get the game board via ajax
        $.ajax({
            url: 'board.html',
            type: 'post'
        }).done(function(response) {

            // render the game board on screen
            $('#game_board').html(response);

            $('#loading_game').hide();

            $('#online_count').show();

            if (data.sign === 'X') {

                $('#sign').html('You: Cross');
            } else {

                $('#sign').html('You: Zero');
            }

            $('#game_info').show();
            // sets the user turn
            set_turn(data);
        });
    });


    // if opponent left the game in between
    socket.on('opponent_left', function() {

        set_values();

        $('.block, #timer, #game_board, #sign').html('');

        // show message when opponent leaves the game
        $('#start_game_div').html('Start new game').show();
        $('#opponent_left_message').html('Your opponent left the game. Please click on "Start new game"\n\
                                    to find new opponent.').show();

        //hide online count
        $('.overlay, #online_count, #game_info').hide();

    });

});

/**
 * sets the player turn
 */
function set_turn(data) {

    // sets the user turn. 
    // 0 = opponents turn
    // 1 = players turn
    if (data.turn == 0) {

        $('.overlay').show();
        $('#turn').html('Opponent\'s turn');
    } else {

        $('.overlay').hide();
        $('#turn').html('Your turn');
    }
}

function set_values() {

    game.counter = 0;
    game.masterBit = 1;
    game.block.one = -1;
    game.block.two = -1;
    game.block.three = -1;
    game.block.four = -1;
    game.block.five = -1;
    game.block.six = -1;
    game.block.seven = -1;
    game.block.eight = -1;
    game.block.nine = -1;

}


// two player logic 
function two_player() {

    var selector = '#one,#two,#three,#four,#five,';
    selector += '#six,#seven,#eight,#nine';

    $('#game_board').on('click', selector, function() {

        if ($(this).html() === '') {

            game.counter++;

            if (game.masterBit === 1) {

                game.masterBit = 0;
                $(this).html("<img src='Image/mark_x.png' width='40' height'40' />");

                game.block[$(this).attr('id')] = 1;

            } else if (game.masterBit === 0) {

                game.masterBit = 1;
                $(this).html("<img src='Image/mark_o.png' width='40' height'40' />");

                game.block[$(this).attr('id')] = 0;
            }

            // push data to server
            socket.emit('client_data', {
                block: game.block,
                masterBit: game.masterBit,
                counter: game.counter
            });

            $('.overlay').show();

        }
    });
}

function game_events() {

    // When user click on start game button
    $('#start_game_div').on('click', function(e) {

        e.stopPropagation();

        socket.emit('start_playing', 1);

        $('#start_game_div, #opponent_left_message').hide();
        $('#opponent_left_message').html('');
        $('#loading_game').show().css({'display': 'block'});

    });
}