from io import BytesIO
from pathlib import Path

import pandas as pd


def _clean_cell(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _find_header_row(dataframe: pd.DataFrame) -> int:
    fallback_index = 0

    for index, row in dataframe.iterrows():
        values = [_clean_cell(value) for value in row.tolist()]
        non_empty_count = sum(bool(value) for value in values)

        if non_empty_count == 0:
            continue

        if non_empty_count >= 2:
            return index

        fallback_index = index

    return fallback_index


def read_spreadsheet(file_path: str | Path) -> dict:
    raw_dataframe = pd.read_excel(file_path, dtype=str, header=None).fillna("")

    if raw_dataframe.empty:
        return {
            "columns": [],
            "row_count": 0,
            "preview": [],
            "rows": [],
        }

    header_row_index = _find_header_row(raw_dataframe)
    header_values = [_clean_cell(value) for value in raw_dataframe.iloc[header_row_index].tolist()]
    valid_columns = [(index, column) for index, column in enumerate(header_values) if column]

    if not valid_columns:
        return {
            "columns": [],
            "row_count": 0,
            "preview": [],
            "rows": [],
        }

    data_rows = raw_dataframe.iloc[header_row_index + 1 :].reset_index(drop=True)
    selected_indexes = [index for index, _ in valid_columns]
    selected_columns = [column for _, column in valid_columns]

    dataframe = data_rows.iloc[:, selected_indexes].copy()
    dataframe.columns = selected_columns
    dataframe = dataframe.map(_clean_cell)
    dataframe = dataframe.loc[
        ~dataframe.apply(lambda row: all(not value for value in row), axis=1)
    ].reset_index(drop=True)

    rows = dataframe.to_dict(orient="records")
    preview = rows[:5]

    return {
        "columns": list(dataframe.columns),
        "row_count": len(rows),
        "preview": preview,
        "rows": rows,
    }


def export_rows_to_xlsx(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    buffer = BytesIO()

    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False)

    buffer.seek(0)
    return buffer.getvalue()
