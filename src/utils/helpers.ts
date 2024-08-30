export function formatResponse(status: Boolean, message: string, data?: any) {
    return { status, message, ...data };
}