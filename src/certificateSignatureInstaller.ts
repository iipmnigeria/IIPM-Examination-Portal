// Certificate signature customisation is intentionally disabled at application startup.
//
// The previous implementation decoded large embedded image payloads and patched
// jsPDF globally while the React bundle was loading. A malformed or unsupported
// image could therefore prevent the entire examination portal from rendering.
//
// The certificate components retain their original built-in signature artwork.
// Approved signature images will be added directly to the certificate component
// and PDF generator in a separate, isolated change that cannot block portal startup.

export {};
