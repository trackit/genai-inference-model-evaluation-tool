from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from bedrock_client import BedrockClient, ConverseStreamError, MODEL_ID_MAP

from factories import DatasetMother, InvocationResultMother


class TestBedrockClient:
  def setup_method(self):
    self.mock_runtime = MagicMock()
    patcher = patch("bedrock_client.boto3.client", return_value=self.mock_runtime)
    patcher.start()
    self.addCleanup = patcher.stop
    self.client = BedrockClient()

  def teardown_method(self):
    self.addCleanup()

  def test_resolve_model_id_maps_known_identifiers(self):
    assert (
      self.client.resolve_model_id("amazon-nova-lite")
      == MODEL_ID_MAP["amazon-nova-lite"]
    )

  def test_resolve_model_id_returns_identifier_when_unknown(self):
    assert self.client.resolve_model_id("custom-model") == "custom-model"

  def test_converse_stream_parses_stream_events(self):
    self.mock_runtime.converse_stream.return_value = {
      "stream": [
        {"contentBlockDelta": {"delta": {"text": "Hello"}}},
        {"contentBlockDelta": {"delta": {"text": " world"}}},
        {
          "metadata": {
            "usage": {"inputTokens": 12, "outputTokens": 8},
          }
        },
      ]
    }

    result = self.client.converse_stream("test-model", "prompt", "doc_0")

    assert result.response_text == "Hello world"
    assert result.input_tokens == 12
    assert result.output_tokens == 8
    assert result.error is None
    assert result.document_id == "doc_0"

  def test_converse_stream_raises_converse_stream_error_on_client_error(self):
    self.mock_runtime.converse_stream.side_effect = ClientError(
      {"Error": {"Code": "ThrottlingException", "Message": "slow down"}},
      "ConverseStream",
    )

    with pytest.raises(ConverseStreamError, match="ThrottlingException"):
      self.client.converse_stream("test-model", "prompt")

  def test_evaluate_models_invokes_each_document_per_model(self):
    dataset = DatasetMother.open(["doc-a", "doc-b"])
    models = [{"identifier": "amazon-nova-lite"}, {"identifier": "custom-model"}]
    db_service = MagicMock()

    with patch.object(
      self.client,
      "converse_stream",
      side_effect=[
        InvocationResultMother.success(response_text="r1", document_id="doc_0"),
        InvocationResultMother.success(response_text="r2", document_id="doc_1"),
        InvocationResultMother.success(response_text="r3", document_id="doc_0"),
        InvocationResultMother.success(response_text="r4", document_id="doc_1"),
      ],
    ) as mock_converse:
      results = self.client.evaluate_models(
        dataset,
        models,
        db_service,
        "eval-1",
        task_instruction="Summarize:",
      )

    assert len(results) == 2
    assert len(results[MODEL_ID_MAP["amazon-nova-lite"]]) == 2
    assert len(results["custom-model"]) == 2
    assert mock_converse.call_count == 4
    db_service.update_progress.assert_called()
