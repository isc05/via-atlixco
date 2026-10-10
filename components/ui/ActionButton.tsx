import type {ComponentProps} from "react";
type ActionButtonProps = ComponentProps<"button">;

export default function ActionButton({ children, className, ...props }: ActionButtonProps) {
  return (
    <button className={`px-4 py-2 rounded-md font-semibold cursor-pointer ${className || ''}`} {...props}>
      {children}
    </button>
  );
}