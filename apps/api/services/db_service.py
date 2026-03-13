from contextlib import contextmanager
from typing import Any, Iterator

from db.connection import get_connection


@contextmanager
def db_cursor() -> Iterator[Any]:
    connection = get_connection()
    cursor = connection.cursor()
    try:
        yield cursor
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.close()
        connection.close()


def fetch_one(query: str, params: tuple[Any, ...] | None = None):
    with db_cursor() as cursor:
        cursor.execute(query, params or ())
        return cursor.fetchone()


def fetch_all(query: str, params: tuple[Any, ...] | None = None):
    with db_cursor() as cursor:
        cursor.execute(query, params or ())
        return cursor.fetchall()


def execute(query: str, params: tuple[Any, ...] | None = None):
    with db_cursor() as cursor:
        cursor.execute(query, params or ())
        if cursor.description:
            return cursor.fetchone()
        return None

