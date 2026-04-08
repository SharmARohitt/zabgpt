<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;
use Exception;

class VoiceAITranslate extends CController {
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

            $text = trim((string) ($payload['text'] ?? ''));
            $target_lang = strtolower(trim((string) ($payload['target_lang'] ?? 'hi')));
            $source_lang = strtolower(trim((string) ($payload['source_lang'] ?? 'en')));

            if ($text === '') {
                throw new Exception('text is required.');
            }

            if (!in_array($target_lang, ['hi', 'en'], true)) {
                throw new Exception('target_lang must be hi or en.');
            }

            if (!in_array($source_lang, ['auto', 'en', 'hi'], true)) {
                $source_lang = 'en';
            }
            

            $text = $this->sanitizeText($text);
            if ($text === '') {
                throw new Exception('text is empty after sanitization.');
            }

            $translated = $this->translateText($text, $source_lang, $target_lang);
            $request_id = str_replace('.', '', uniqid('translate_', true));

            echo json_encode([
                'success' => true,
                'translated_text' => $translated,
                'provider' => 'google_translate_public',
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
        $clean = preg_replace('/\s+/u', ' ', $text);
        if ($clean === null) {
            $clean = $text;
        }

        $clean = trim($clean);

        if (function_exists('mb_substr')) {
            return mb_substr($clean, 0, 1200);
        }

        return substr($clean, 0, 1200);
    }

    private function translateText(string $text, string $source_lang, string $target_lang): string {
        if ($source_lang === $target_lang) {
            return $text;
        }

        $query = http_build_query([
            'client' => 'gtx',
            'sl' => $source_lang,
            'tl' => $target_lang,
            'dt' => 't',
            'q' => $text
        ]);

        $url = 'https://translate.googleapis.com/translate_a/single?' . $query;
        $response = $this->httpGet($url, 6);
        if ($response === '') {
            throw new Exception('Translation service returned an empty response.');
        }

        $json = json_decode($response, true);
        if (!is_array($json) || !isset($json[0]) || !is_array($json[0])) {
            throw new Exception('Translation response is invalid.');
        }

        $parts = [];
        foreach ($json[0] as $segment) {
            if (is_array($segment) && isset($segment[0]) && is_string($segment[0])) {
                $parts[] = $segment[0];
            }
        }

        $translated = trim(implode('', $parts));
        if ($translated === '') {
            throw new Exception('Translation produced empty text.');
        }

        return $translated;
    }

    private function httpGet(string $url, int $timeout): string {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
                curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Accept: application/json',
                    'User-Agent: ZabGPT/1.0'
                ]);
                $body = curl_exec($ch);
                $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($body !== false && $http_code >= 200 && $http_code < 300) {
                    return (string) $body;
                }
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => $timeout,
                'header' => "Accept: application/json\r\nUser-Agent: ZabGPT/1.0\r\n"
            ]
        ]);

        $body = @file_get_contents($url, false, $context);
        if ($body === false) {
            return '';
        }

        return (string) $body;
    }
}
