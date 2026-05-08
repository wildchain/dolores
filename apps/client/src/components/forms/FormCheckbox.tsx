"use client";
import { Checkbox, type CheckboxProps } from "@mantine/core";
import { useController, type Control } from "react-hook-form";

interface FormCheckboxProps extends Omit<CheckboxProps, "error"> {
  name: string;
  control: Control<any>;
  label?: string;
}

export function FormCheckbox({
  name,
  control,
  label,
  ...props
}: FormCheckboxProps) {
  const {
    field: { value, onChange, ...field },
  } = useController({ name, control });

  return (
    <Checkbox
      {...field}
      {...props}
      checked={value}
      onChange={e => onChange(e.currentTarget.checked)}
      label={label}
      classNames={{
        root: "mb-3",
        label: "text-[13px] text-muted ml-2",
        input:
          "border-jade/30 cursor-pointer checked:bg-jadeDeep checked:border-jadeDeep",
      }}
    />
  );
}
