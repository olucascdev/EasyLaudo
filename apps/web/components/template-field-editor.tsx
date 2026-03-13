"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TemplateFieldEditorProps = {
  text: string;
  detectedFields: string[];
  fields: string[];
  onFieldsChange: (fields: string[]) => void;
};

type SegmentTone = "plain" | "detected" | "manual" | "suspect";

type SelectionDialog = {
  selectedText: string;
};

const MARKER_PATTERN = /\{\{\s*([^{}\n\r]+?)\s*\}\}/g;
const SUSPECT_PATTERN = /(\{\{[^}\n\r]{1,80}|[^{}\n\r]{1,80}\}\}|\{[^{}\n\r]{2,80}\})/g;

function normalizeFieldName(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    return trimmed.slice(2, -2).trim();
  }

  return trimmed;
}

function inferFieldName(value: string) {
  const normalized = normalizeFieldName(value);
  if (!normalized) {
    return "";
  }

  if (normalized.includes(" ")) {
    return normalized.replace(/\s+/g, "_").toLowerCase();
  }

  return normalized;
}

function buildTextSegments(text: string): Array<{ value: string; tone: SegmentTone }> {
  const segments: Array<{ value: string; tone: SegmentTone }> = [];
  let lastIndex = 0;
  SUSPECT_PATTERN.lastIndex = 0;
  let suspectMatch = SUSPECT_PATTERN.exec(text);

  while (suspectMatch) {
    const suspect = suspectMatch[0];
    const index = suspectMatch.index ?? 0;

    if (index > lastIndex) {
      segments.push({ value: text.slice(lastIndex, index), tone: "plain" });
    }

    segments.push({ value: suspect, tone: "suspect" });
    lastIndex = index + suspect.length;
    suspectMatch = SUSPECT_PATTERN.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ value: text.slice(lastIndex), tone: "plain" });
  }

  return segments.length ? segments : [{ value: text, tone: "plain" }];
}

function getLineSegments(
  line: string,
  detectedFields: Set<string>,
  confirmedFields: Set<string>
): Array<{ value: string; tone: SegmentTone; key: string }> {
  const segments: Array<{ value: string; tone: SegmentTone; key: string }> = [];
  let lastIndex = 0;
  MARKER_PATTERN.lastIndex = 0;
  let match = MARKER_PATTERN.exec(line);

  while (match) {
    const [token, rawField] = match;
    const field = normalizeFieldName(rawField);
    const index = match.index ?? 0;

    if (index > lastIndex) {
      buildTextSegments(line.slice(lastIndex, index)).forEach((segment, segmentIndex) => {
        segments.push({
          key: `text-${index}-${segmentIndex}`,
          value: segment.value,
          tone: segment.tone
        });
      });
    }

    const confirmed = confirmedFields.has(field);
    const detected = detectedFields.has(field);
    segments.push({
      key: `field-${field}-${index}`,
      value: token,
      tone: confirmed ? (detected ? "detected" : "manual") : "suspect"
    });

    lastIndex = index + token.length;
    match = MARKER_PATTERN.exec(line);
  }

  if (lastIndex < line.length) {
    buildTextSegments(line.slice(lastIndex)).forEach((segment, segmentIndex) => {
      segments.push({
        key: `tail-${lastIndex}-${segmentIndex}`,
        value: segment.value,
        tone: segment.tone
      });
    });
  }

  return segments.length
    ? segments
    : [
        {
          key: "plain-line",
          value: line,
          tone: "plain" as const
        }
      ];
}

function toneClassName(tone: SegmentTone) {
  if (tone === "detected") {
    return "rounded-md bg-emerald-100 px-1 py-0.5 text-emerald-950 ring-1 ring-emerald-200";
  }

  if (tone === "manual") {
    return "rounded-md bg-sky-100 px-1 py-0.5 text-sky-950 ring-1 ring-sky-200";
  }

  if (tone === "suspect") {
    return "rounded-md bg-amber-100 px-1 py-0.5 text-amber-950 ring-1 ring-amber-200";
  }

  return "";
}

export function TemplateFieldEditor({ text, detectedFields, fields, onFieldsChange }: TemplateFieldEditorProps) {
  const [manualFieldName, setManualFieldName] = useState("");
  const [selectionName, setSelectionName] = useState("");
  const [selectionDialog, setSelectionDialog] = useState<SelectionDialog | null>(null);

  const detectedSet = new Set(detectedFields.map(normalizeFieldName).filter(Boolean));
  const confirmedSet = new Set(fields.map(normalizeFieldName).filter(Boolean));

  function updateFields(nextFields: string[]) {
    const normalized = nextFields.map(normalizeFieldName).filter(Boolean);
    const uniqueFields = normalized.filter((field, index) => normalized.indexOf(field) === index);
    onFieldsChange(uniqueFields);
  }

  function addField(rawValue: string) {
    const field = normalizeFieldName(rawValue);
    if (!field) {
      toast.error("Informe um nome para o campo.");
      return;
    }

    if (confirmedSet.has(field)) {
      toast.error("Esse campo ja esta confirmado.");
      return;
    }

    updateFields([...fields, field]);
  }

  function removeField(fieldToRemove: string) {
    updateFields(fields.filter((field) => normalizeFieldName(field) !== fieldToRemove));
  }

  function handleManualAdd() {
    addField(manualFieldName);
    setManualFieldName("");
  }

  function handleSelectionAdd() {
    addField(selectionName);
    setSelectionDialog(null);
    setSelectionName("");

    const selection = window.getSelection();
    selection?.removeAllRanges();
  }

  function handleDocumentMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const selectedText = selection.toString().replace(/\s+/g, " ").trim();
    if (!selectedText) {
      return;
    }

    setSelectionDialog({ selectedText });
    setSelectionName(inferFieldName(selectedText));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-emerald-900">
            Verde: detectado e confirmado
          </Badge>
          <Badge variant="secondary" className="border border-amber-200 bg-amber-50 text-amber-900">
            Amarelo: suspeito
          </Badge>
          <Badge variant="secondary" className="border border-sky-200 bg-sky-50 text-sky-900">
            Azul: adicionado manualmente
          </Badge>
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-zinc-50/80 p-4">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Visualizacao do documento</p>
              <p className="text-sm text-zinc-500">Selecione um trecho do texto para criar um campo manual.</p>
            </div>
            <Badge variant="outline" className="border-zinc-300 bg-white text-zinc-700">
              {detectedFields.length} detectados automaticamente
            </Badge>
          </div>

          <div
            className="relative mt-4 max-h-[55vh] overflow-auto rounded-[22px] border border-zinc-200 bg-white p-5"
            onMouseUp={handleDocumentMouseUp}
          >
            {text ? (
              <div className="space-y-3 text-sm leading-7 text-zinc-800">
                {text.split("\n").map((line, lineIndex) => (
                  <p key={`line-${lineIndex}`} className="min-h-7 whitespace-pre-wrap break-words">
                    {line ? (
                      getLineSegments(line, detectedSet, confirmedSet).map((segment) => (
                        <span key={`${lineIndex}-${segment.key}`} className={cn("select-text", toneClassName(segment.tone))}>
                          {segment.value}
                        </span>
                      ))
                    ) : (
                      <span className="select-text text-transparent">.</span>
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
                Nenhum texto renderizavel foi retornado para este documento.
              </div>
            )}
          </div>
        </div>

        <Dialog
          open={Boolean(selectionDialog)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectionDialog(null);
              setSelectionName("");
            }
          }}
        >
          <DialogContent className="max-w-md rounded-[28px]">
            <DialogHeader>
              <DialogTitle>Criar campo</DialogTitle>
              <DialogDescription>O trecho selecionado sera usado para sugerir o nome do novo campo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Trecho selecionado</p>
                <p className="mt-2 text-sm text-zinc-600">{selectionDialog?.selectedText}</p>
              </div>
              <Input
                autoFocus
                value={selectionName}
                onChange={(event) => setSelectionName(event.target.value)}
                placeholder="nome_do_campo"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSelectionAdd();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectionDialog(null);
                  setSelectionName("");
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={handleSelectionAdd}>
                Adicionar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
        <div className="border-b border-zinc-200 pb-4">
          <p className="text-sm font-semibold text-zinc-950">Campos confirmados</p>
          <p className="mt-1 text-sm text-zinc-500">{fields.length} campos confirmados</p>
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={manualFieldName}
            onChange={(event) => setManualFieldName(event.target.value)}
            placeholder="Adicionar pelo nome"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleManualAdd();
              }
            }}
          />
          <Button type="button" onClick={handleManualAdd}>
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <div className="mt-5 max-h-[55vh] space-y-2 overflow-auto pr-1">
          {fields.length ? (
            fields.map((field) => (
              <div
                key={field}
                className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
              >
                <code className="truncate text-sm font-medium text-zinc-900">{`{{${field}}}`}</code>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field)} aria-label={`Remover ${field}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-500">
              Nenhum campo confirmado. Adicione ao menos um para salvar o modelo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
