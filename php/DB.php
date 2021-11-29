<?php


    class DB
    {
        private static $instance = null;
        private static $config = [
            'db_type' => 'mysql',
            'db_host' => 'localhost',
            'db_name' => 'database_name',
            'db_username' => 'user',
            'db_password' => 'secret',
        ];

        public static function connect($username, $password,  $database, $charset='utf8', $host='localhost', $type='mysql') {
            if (self::$instance) {
                throw new Exception('Instance already created');
            }
            $connection_string = $type.':host=' . $host . ';dbname=' . $database . ';charset='.$charset;
            self::$instance = new PDO($connection_string, $username, $password);
            self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            return self::$instance;
        }


        public static function getInstance()
        {
            if (!self::$instance) {
                $connection_string = self::$config['db_type'] . ':host=' . self::$config['db_host'] . ';dbname=' . self::$config['db_name'] . ';charset=utf8';
                self::$instance = new PDO($connection_string, self::$config['db_username'], self::$config['db_password']);
                self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                return self::$instance;
            }
            return self::$instance;
        }


        public static function get_value($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
            $res->execute($data);
            // dd($res);
            return $res->fetchColumn();
        }


        public static function get_values($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                var_dump($e);
            }
            return $res->fetch(PDO::FETCH_NUM);
        }


        public static function insert($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
            // dd($res);
            $res->execute($data);
            return self::getInstance()->lastInsertId();
        }


        public static function update($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
            // dd($res);
            $res->execute($data);
        }


        public static function get_array($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
//             echo "+---> $sql<br />";
            $res->execute($data);
            return $res->fetch(PDO::FETCH_ASSOC);
        }


        public static function query($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }
            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                var_dump($e);
            }

            return;
        }


        public static function q($sql, $data = [])
        {
            if (gettype($data) !== 'array') {
                $data = [$data];
            }

            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                var_dump($e);
            }

            return $res->fetchAll(PDO::FETCH_ASSOC);
        }
    }


    function reply($a)
    {
        header('Content-Type: application/json');
        die(json_encode($a));
    }

    function dd($a) {
        var_dump($a);
        die();
    }

    function getInput() {
        return json_decode(file_get_contents('php://input'));
    }