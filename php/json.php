<?php
    function sendReply($a)
    {
        die(json_encode([
            'error' => 0,
            'data' => $a,
        ]));
    }


    function sendError($code = 1, $message = 'error')
    {
        die(json_encode([
            'error' => $code,
            'message' => $message,
            'data' => null,
        ]));
    }