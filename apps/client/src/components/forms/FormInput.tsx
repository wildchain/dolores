"use client";
import { TextInput, type TextInputProps } from "@mantine/core";
import { useController, type Control } from "react-hook-form";

interface FormInputProps extends Omit<TextInputProps, "error"> {
  name: string;
  control: Control<any>;
  label?: string;
}

export function FormInput({ name, control, label, ...props }: FormInputProps) {
  const {
    field,
    fieldState: { error },
  } = useController({ name, control });

  return (
    <TextInput
      {...field}
      {...props}
      label={label}
      error={error?.message}
      classNames={{
        root: "mb-3",
        label: "font-mono text-[11px] text-jadeMid mb-1.5",
        input:
          "bg-stone border border-jade/25 rounded-sm px-3.5 py-2.5 text-ink font-mono text-[13px] placeholder:text-jade/60 focus:border-jadeDark focus:bg-white transition-all",
        error: "text-[11px] text-danger mt-1",
      }}
      styles={{
        input: {
          "&:focus": {
            borderColor: "#4A5640",
          },
        },
      }}
    />
  );
}
