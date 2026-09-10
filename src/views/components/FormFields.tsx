import { Eye, EyeOff } from "lucide-react";
import {
	type InputHTMLAttributes,
	type ReactNode,
	type SelectHTMLAttributes,
	useId,
	useState,
} from "react";

export function Field({
	label,
	htmlFor,
	hint,
	error,
	children,
}: {
	label: ReactNode;
	htmlFor?: string;
	hint?: ReactNode;
	error?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="field-group">
			{htmlFor ? (
				<label className="field-label" htmlFor={htmlFor}>
					{label}
				</label>
			) : (
				<span className="field-label">{label}</span>
			)}
			{children}
			{error ? (
				<p className="field-error" role="alert">
					{error}
				</p>
			) : hint ? (
				<p className="field-hint">{hint}</p>
			) : null}
		</div>
	);
}

export function TextInput({
	className,
	...props
}: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input className={className ? `field ${className}` : "field"} {...props} />
	);
}

export function PasswordInput({
	id,
	value,
	onValueChange,
	disabled,
	autoComplete,
	required,
	minLength,
	name,
	"aria-invalid": ariaInvalid,
	"aria-describedby": ariaDescribedBy,
	"aria-label": ariaLabel,
	onKeyDown,
}: {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	autoComplete?: string;
	required?: boolean;
	minLength?: number;
	name?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
	"aria-label"?: string;
	onKeyDown?: InputHTMLAttributes<HTMLInputElement>["onKeyDown"];
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="password-field">
			<input
				id={id}
				name={name}
				className="field hide-password-toggle"
				type={visible ? "text" : "password"}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				disabled={disabled}
				autoComplete={autoComplete}
				required={required}
				minLength={minLength}
				spellCheck={false}
				aria-invalid={ariaInvalid}
				aria-describedby={ariaDescribedBy}
				aria-label={ariaLabel}
				onKeyDown={onKeyDown}
			/>
			<button
				type="button"
				className="password-toggle"
				onClick={() => setVisible((current) => !current)}
				disabled={disabled}
				aria-label={visible ? "Hide password" : "Show password"}
				aria-pressed={visible}
			>
				{visible ? (
					<EyeOff size={18} aria-hidden="true" />
				) : (
					<Eye size={18} aria-hidden="true" />
				)}
			</button>
		</div>
	);
}

export function CheckboxField({
	id,
	checked,
	onCheckedChange,
	disabled,
	required,
	children,
}: {
	id?: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	disabled?: boolean;
	required?: boolean;
	children: ReactNode;
}) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	return (
		<div className="checkbox-field">
			<input
				id={inputId}
				className="checkbox-control"
				type="checkbox"
				checked={checked}
				onChange={(event) => onCheckedChange(event.target.checked)}
				disabled={disabled}
				required={required}
			/>
			<label className="checkbox-label" htmlFor={inputId}>
				{children}
			</label>
		</div>
	);
}

export function SelectInput({
	className,
	children,
	...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
	return (
		<select className={className ? `select ${className}` : "select"} {...props}>
			{children}
		</select>
	);
}
