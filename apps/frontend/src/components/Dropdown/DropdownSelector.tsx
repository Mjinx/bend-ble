import { ChangeEventHandler } from "react";

export type SelectOption<T> = { disabled?: boolean; value: T; display: string };
type Props<T> = {
  items: SelectOption<T>[];
  selectedItem?: T;
  onSelect: (value: T) => void;
};

const DropdownSelector = <T extends string | number>({
  items,
  selectedItem,
  onSelect
}: Props<T>) => {
  const handleSelectChange: ChangeEventHandler<HTMLSelectElement> = (e) => {
    const selectedValue = items.find(
      (item) => String(item.value) === e.target.value
    )?.value;

    if (selectedValue !== undefined) {
      onSelect(selectedValue);
    }
  };

  return (
    <>
      <label htmlFor="dropdown" className="text-sm font-medium">
        Select an Item:
      </label>
      <select
        id="dropdown"
        value={selectedItem !== undefined ? String(selectedItem) : ""}
        onChange={handleSelectChange}
        className="border rounded-md px-2 py-1"
      >
        <option value="" disabled>
          -- Choose an option --
        </option>
        {items.map(({ value, display, disabled }) => (
          <option key={value} value={String(value)} disabled={disabled}>
            {display}
          </option>
        ))}
      </select>
    </>
  );
};

export default DropdownSelector;
