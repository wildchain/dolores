export interface CreateReceiptDto {
    agentId: string;
    taskId: string;
    outputHash: string;
    timestamp: number;
    agentSignature: string;
}