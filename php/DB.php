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


        /**
         * @param $username - Database user to to use
         * @param $password - Database password for the user
         * @param $database - Database name
         * @param string $charset - The DB encoding. Default is utf8
         * @param string $host - The host to connect to. Default is localhsot
         * @param string $type - The type of the DB. Default is MySQL
         * @return PDO|null
         * @throws Exception
         */
        public static function connect($username, $password, $database, $charset='utf8', $host='localhost', $type='mysql') {
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


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return mixed - The result of the query
         */
        public static function get_value($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
            $res->execute($data);
            // dd($res);
            return $res->fetchColumn();
        }


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return array - The result of the query as an array
         */
        public static function get_values($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                var_dump($e);
            }
            return $res->fetch(PDO::FETCH_NUM);
        }



        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return numeric - The ID of the inserted row
         */
        public static function insert($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
            // dd($res);
            $res->execute($data);
            return self::getInstance()->lastInsertId();
        }


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return null - Returns nothing
         */
        public static function update($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
            // dd($res);
            $res->execute($data);
            return null;
        }


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return array - The result as an array of arrays
         */
        public static function as_array($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
//             echo "+---> $sql<br />";
            $res->execute($data);
            return $res->fetch(PDO::FETCH_ASSOC);
        }


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return null|bool - null on success, false if the query fails
         */
        public static function query($sql, $data = [])
        {
            $data = self::ensureIsArray($data);
            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                return false;
            }

            return null;
        }


        /**
         * @param string $sql - The SQL to execute
         * @param array $data - Data binded
         * @return array|bool - Array of objects on success, false if the query fails
         */
        public static function as_object($sql, $data = [])
        {
            $data = self::ensureIsArray($data);

            $res = self::getInstance()->prepare($sql);
            try {
                $res->execute($data);
            } catch (Exception $e) {
                return false;
            }

            return $res->fetchAll(PDO::FETCH_ASSOC);
        }


        /**
         * @param array $data
         * @return array|array[]
         */
        protected static function ensureIsArray(array $data)
        {
            return gettype($data) !== 'array' ? [$data] : $data;
        }
    }
