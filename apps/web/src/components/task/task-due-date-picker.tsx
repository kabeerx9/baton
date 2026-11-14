import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";

type TaskDueDatePickerProps = {
  label: string;
  clearLabel: string;
  dueDate: Date | null;
  startDate?: Date;
  onDateChange: (date: Date | null) => void;
};

// Shared by an existing task's due date popover and the create task modal.
export default function TaskDueDatePicker({
  label,
  clearLabel,
  dueDate,
  startDate,
  onDateChange,
}: TaskDueDatePickerProps) {
  const { t } = useTranslation();

  return (
    <DatePickerMenu
      label={label}
      placeholder={t("tasks:datePicker.dueDatePlaceholder")}
      clearLabel={clearLabel}
      value={dueDate}
      onChange={onDateChange}
      bounds={startDate ? { before: startDate } : undefined}
      formatLimit={(date) => t("tasks:datePicker.startsOn", { date })}
    />
  );
}
