export interface ConvertSuccessResponse {
  success: true;
  data: {
    id: string;
    downloadUrl: string;
    filename: string;
    sizeBytes: number;
    expiresAt: string;
  };
}

export interface ConvertErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    timestamp: string;
  };
}