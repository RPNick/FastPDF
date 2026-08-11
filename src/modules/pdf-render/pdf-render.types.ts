export interface RenderOptions {
    width?: number;
    height?: number;
    format?: 'A4' | 'Letter' | 'Legal';
    margin?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };
    timeout?: number;
    waitUntil?: 'load' | 'domcontentloaded';
}

export interface RenderRequest {
    html: string;
    options?: RenderOptions;
}