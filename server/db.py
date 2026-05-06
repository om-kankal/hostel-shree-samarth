import os
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'sspg'),
    'port': int(os.getenv('DB_PORT', 3306)),
}


def get_connection():
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Error as error:
        raise RuntimeError(f'Unable to connect to database: {error}')


def row_to_dict(cursor, row):
    return {column[0]: value for column, value in zip(cursor.description, row)}
