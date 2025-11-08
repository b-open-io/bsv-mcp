export function arrayBufferToUint8Array(buffer: ArrayBuffer): number[] {
	const uint8Array = new Uint8Array(buffer);
	return Array.from(uint8Array);
}

export function numArrayToUint8Array(numArray: number[]): Uint8Array {
	return new Uint8Array(numArray);
}

export function numArrayToBuffer(numArray: number[]): ArrayBuffer {
	return new Uint8Array(numArray).buffer;
}
