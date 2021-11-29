<?php
    $a = array_key_exists('action', $_REQUEST) ? $_REQUEST['a'] : '';
    include '../php/json.php';

    if (!$a) {
        sendError();
    }

    $fun = "a_$a";

    if (!function_exists($fun)) {
        sendError();
    }

    $fun();