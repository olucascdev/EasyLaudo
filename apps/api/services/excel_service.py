from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pandas as pd

HEADER_SCAN_LIMIT = 25
DATA_SAMPLE_LIMIT = 50
PREVIEW_LIMIT = 5


@dataclass
class HeaderCandidate:
    row_index: int
    column_indexes: list[int]
    raw_headers: list[str]
    score: float


@dataclass
class SheetParseResult:
    sheet_name: str
    header_row_index: int
    columns: list[str]
    rows: list[dict[str, str]]
    score: float


def _clean_cell(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def _normalize_label(value: str) -> str:
    return "".join(character.lower() for character in value if character.isalnum())


def _is_empty_row(values: list[str]) -> bool:
    return all(not value for value in values)


def _is_numeric_like(value: str) -> bool:
    compact = value.replace(" ", "")
    if not compact:
        return False
    if any(character.isalpha() for character in compact):
        return False
    return any(character.isdigit() for character in compact)


def _deduplicate_headers(headers: list[str]) -> list[str]:
    occurrences: dict[str, int] = {}
    normalized_headers: list[str] = []

    for index, header in enumerate(headers, start=1):
        base_header = header or f"coluna_{index}"
        count = occurrences.get(base_header, 0) + 1
        occurrences[base_header] = count
        normalized_headers.append(base_header if count == 1 else f"{base_header}_{count}")

    return normalized_headers


def _row_fill_ratio(values: list[str]) -> float:
    if not values:
        return 0.0
    return sum(bool(value) for value in values) / len(values)


def _is_repeated_header_row(values: list[str], header_signature: list[str]) -> bool:
    comparable = 0
    matches = 0

    for index, value in enumerate(values):
        normalized_value = _normalize_label(value)
        if not normalized_value:
            continue

        comparable += 1
        if index < len(header_signature) and normalized_value == header_signature[index]:
            matches += 1

    if comparable < 2:
        return False

    return matches / comparable >= 0.8


def _extract_candidate_metrics(
    dataframe: pd.DataFrame,
    row_index: int,
    column_indexes: list[int],
    raw_headers: list[str],
) -> tuple[int, float, int]:
    sample_frame = dataframe.iloc[row_index + 1 :, column_indexes].copy()
    if sample_frame.empty:
        return 0, 0.0, 0

    sample_frame = sample_frame.map(_clean_cell)
    non_empty_frame = sample_frame.loc[
        sample_frame.apply(lambda row: any(row), axis=1)
    ].head(DATA_SAMPLE_LIMIT)

    if non_empty_frame.empty:
        return 0, 0.0, 0

    header_signature = [_normalize_label(header) for header in raw_headers]
    repeated_header_rows = sum(
        _is_repeated_header_row(
            [_clean_cell(value) for value in row.tolist()],
            header_signature,
        )
        for _, row in non_empty_frame.iterrows()
    )
    fill_ratio = float(
        non_empty_frame.apply(
            lambda row: _row_fill_ratio([_clean_cell(value) for value in row.tolist()]),
            axis=1,
        ).mean()
    )

    return len(non_empty_frame), fill_ratio, repeated_header_rows


def _score_header_candidate(dataframe: pd.DataFrame, row_index: int) -> HeaderCandidate | None:
    values = [_clean_cell(value) for value in dataframe.iloc[row_index].tolist()]
    column_indexes = [index for index, value in enumerate(values) if value]

    if not column_indexes:
        return None

    raw_headers = [values[index] for index in column_indexes]
    sample_row_count, fill_ratio, repeated_header_rows = _extract_candidate_metrics(
        dataframe,
        row_index,
        column_indexes,
        raw_headers,
    )

    if len(column_indexes) == 1 and sample_row_count < 2:
        return None

    normalized_headers = [_normalize_label(header) for header in raw_headers]
    unique_ratio = len(set(normalized_headers)) / len(normalized_headers)
    text_like_ratio = sum(any(character.isalpha() for character in header) for header in raw_headers) / len(raw_headers)
    numeric_like_ratio = sum(_is_numeric_like(header) for header in raw_headers) / len(raw_headers)
    compact_ratio = sum(len(header) <= 40 for header in raw_headers) / len(raw_headers)

    score = (
        len(column_indexes) * 2.5
        + min(sample_row_count, DATA_SAMPLE_LIMIT) * 0.25
        + unique_ratio * 2.0
        + text_like_ratio * 1.5
        + fill_ratio * 2.0
        + compact_ratio
        - numeric_like_ratio * 2.0
        - repeated_header_rows * 0.5
    )

    return HeaderCandidate(
        row_index=row_index,
        column_indexes=column_indexes,
        raw_headers=raw_headers,
        score=score,
    )


def _extract_rows(
    dataframe: pd.DataFrame,
    header_row_index: int,
    column_indexes: list[int],
    raw_headers: list[str],
) -> tuple[list[str], list[dict[str, str]]]:
    if not column_indexes:
        return [], []

    data_rows = dataframe.iloc[header_row_index + 1 :, column_indexes].copy()
    columns = _deduplicate_headers(raw_headers)

    if data_rows.empty:
        return columns, []

    data_rows.columns = columns
    data_rows = data_rows.map(_clean_cell)
    header_signature = [_normalize_label(header) for header in raw_headers]

    filtered_rows: list[dict[str, str]] = []
    for _, row in data_rows.iterrows():
        values = [_clean_cell(value) for value in row.tolist()]
        if _is_empty_row(values):
            continue
        if _is_repeated_header_row(values, header_signature):
            continue
        filtered_rows.append(dict(zip(columns, values)))

    return columns, filtered_rows


def _parse_sheet(sheet_name: str, dataframe: pd.DataFrame) -> SheetParseResult | None:
    if dataframe.empty:
        return None

    scan_limit = min(len(dataframe.index), HEADER_SCAN_LIMIT)
    candidates = [
        candidate
        for row_index in range(scan_limit)
        if (candidate := _score_header_candidate(dataframe, row_index)) is not None
    ]

    if not candidates:
        return None

    best_candidate = max(candidates, key=lambda candidate: candidate.score)
    columns, rows = _extract_rows(
        dataframe,
        best_candidate.row_index,
        best_candidate.column_indexes,
        best_candidate.raw_headers,
    )

    if not columns:
        return None

    score = best_candidate.score + min(len(rows), DATA_SAMPLE_LIMIT) * 0.1
    return SheetParseResult(
        sheet_name=sheet_name,
        header_row_index=best_candidate.row_index,
        columns=columns,
        rows=rows,
        score=score,
    )


def read_spreadsheet(file_path: str | Path) -> dict:
    workbook = pd.ExcelFile(file_path, engine="openpyxl")
    parsed_sheets: list[SheetParseResult] = []

    for sheet_name in workbook.sheet_names:
        raw_dataframe = workbook.parse(sheet_name=sheet_name, dtype=str, header=None).fillna("")
        parsed_sheet = _parse_sheet(sheet_name, raw_dataframe)
        if parsed_sheet is not None:
            parsed_sheets.append(parsed_sheet)

    if not parsed_sheets:
        return {
            "columns": [],
            "row_count": 0,
            "preview": [],
            "rows": [],
            "sheet_name": workbook.sheet_names[0] if workbook.sheet_names else None,
            "header_row_index": None,
        }

    best_sheet = max(parsed_sheets, key=lambda sheet: sheet.score)
    preview = best_sheet.rows[:PREVIEW_LIMIT]

    return {
        "columns": best_sheet.columns,
        "row_count": len(best_sheet.rows),
        "preview": preview,
        "rows": best_sheet.rows,
        "sheet_name": best_sheet.sheet_name,
        "header_row_index": best_sheet.header_row_index,
    }


def export_rows_to_xlsx(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    buffer = BytesIO()

    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        dataframe.to_excel(writer, index=False)

    buffer.seek(0)
    return buffer.getvalue()
