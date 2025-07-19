import sqlite3

def get_db_connection():
    conn = sqlite3.connect("backend/db.sqlite3")
    conn.row_factory = sqlite3.Row
    return conn
