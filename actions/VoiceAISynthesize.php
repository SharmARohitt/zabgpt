<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;
use Exception;

class VoiceAISynthesize extends CController {
    public function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        return true;
    }

    public function checkPermissions(): bool {
        return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
    }

    protected function doAction(): void {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $raw = file_get_contents('php://input');
            $payload = json_decode((string) $raw, true) ?: [];

            $text = (string) ($payload['text'] ?? '');
            $answer_id = trim((string) ($payload['answer_id'] ?? ''));
            $voice = trim((string) ($payload['voice'] ?? 'default'));
            $speed = (float) ($payload['speed'] ?? 1.0);

            if ($answer_id === '') {
                throw new Exception('answer_id is required.');
            }

            $sanitized = $this->sanitizeText($text);
            if ($sanitized === '') {
                throw new Exception('text is empty after sanitization.');
            }

            if ($speed <= 0) {
                $speed = 1.0;
            }

            $request_id = str_replace('.', '', uniqid('voice_', true));

            echo json_encode([
                'success' => true,
                'audio_base64' => '',
                'mime_type' => 'audio/mpeg',
                'provider' => 'browser_tts',
                'request_id' => $request_id
            ], JSON_UNESCAPED_UNICODE);
        }
        catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
        }

        exit;
    }

    private function sanitizeText(string $text): string {
        // Strip fenced code blocks first to prevent noisy spoken output.
        $clean = preg_replace('/```[\s\S]*?```/u', ' ', $text);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/`[^`]*`/u', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/(^|\n)\s*(top|ps|iostat|vmstat|htop|netstat|kubectl|docker|systemctl|journalctl|cat|tail|grep|awk|sed)\b[^\n]*/iu', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/\b(top|ps|iostat|vmstat|htop|netstat|kubectl|docker|systemctl|journalctl|cat|tail|grep|awk|sed)\b(?:\s+[-\w\/.=:]+){0,12}/iu', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/[A-Za-z]:\\\\[^\s]+|(?:\/[^\s]+){2,}/u', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/[*_~>#]+/u', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = preg_replace('/\s+/u', ' ', $clean);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = trim($clean);

        if (function_exists('mb_substr')) {
            $clean = mb_substr($clean, 0, 1200);
        }
        else {
            $clean = substr($clean, 0, 1200);
        }

        return $clean;
    }
}
