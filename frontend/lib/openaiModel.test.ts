import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_MODEL, chatBody, modelFor } from './openaiModel.ts';

test('아무것도 안 정하면 안전한 기본값', () => {
  assert.equal(modelFor('facts', {}), DEFAULT_MODEL);
});

test('OPENAI_MODEL 하나로 네 곳이 함께 올라간다', () => {
  const env = { OPENAI_MODEL: 'gpt-4.1' };
  for (const p of ['facts', 'lyrics', 'questions', 'log'] as const) {
    assert.equal(modelFor(p, env), 'gpt-4.1');
  }
});

test('일별 설정이 기본 설정을 이긴다', () => {
  const env = { OPENAI_MODEL: 'gpt-4o-mini', OPENAI_MODEL_FACTS: 'gpt-4.1' };
  assert.equal(modelFor('facts', env), 'gpt-4.1');
  assert.equal(modelFor('lyrics', env), 'gpt-4o-mini');
});

test('빈 값은 안 정한 것으로 본다', () => {
  assert.equal(modelFor('lyrics', { OPENAI_MODEL: '  ' }), DEFAULT_MODEL);
});

test('예전 계열은 max_tokens 와 temperature 를 그대로 받는다', () => {
  const body = chatBody({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: '안녕' }],
    temperature: 0.2,
    maxTokens: 700,
    json: true,
  });
  assert.equal(body.max_tokens, 700);
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('새 계열은 max_completion_tokens 를 쓰고 temperature 를 빼야 한다', () => {
  const body = chatBody({
    model: 'gpt-5',
    messages: [{ role: 'user', content: '안녕' }],
    temperature: 0.2,
    maxTokens: 700,
  });
  assert.equal(body.max_completion_tokens, 700);
  assert.equal('max_tokens' in body, false);
  assert.equal('temperature' in body, false);
});

test('모르는 이름은 예전 모양 그대로 둔다', () => {
  const body = chatBody({
    model: 'some-new-model',
    messages: [{ role: 'user', content: '안녕' }],
    temperature: 0.5,
    maxTokens: 100,
  });
  assert.equal(body.max_tokens, 100);
  assert.equal(body.temperature, 0.5);
});
