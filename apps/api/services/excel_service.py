from io import BytesIO
from pathlib import Path

import pandas as pd


def read_spreadsheet(file_path: str | Path) -> dict:
    dataframe = pd.read_excel(file_path, dtype=str).fillna("")
    dataframe.columns = [str(column).strip() for column in dataframe.columns]

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

