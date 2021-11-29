<?php
    function sendReply($a)
    {
        header('Content-Type: application/json');
        die(json_encode([
            'error' => 0,
            'data' => $a,
        ]));
    }


    function sendError($code = 1, $message = 'error')
    {
        header('Content-Type: application/json');
        die(json_encode([
            'error' => $code,
            'message' => $message,
            'data' => null,
        ]));
    }

    function dd($a) {
        var_dump($a);
        die();
    }

    function getInput() {
        return json_decode(file_get_contents('php://input'));
    }

