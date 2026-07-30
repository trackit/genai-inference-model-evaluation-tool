import json
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError

from dataset_loader import Dataset, DatasetLoader

from factories import DatasetMother


class TestDataset:
  def test_documents_extracts_document_field(self):
    dataset = DatasetMother.summarization()

    assert dataset.documents == ["First document.", "Second document."]

  def test_summaries_returns_none_when_column_missing(self):
    dataset = DatasetMother.open()

    assert dataset.summaries is None
    assert dataset.class_labels is None

  def test_class_labels_returns_none_when_column_missing(self):
    dataset = DatasetMother.summarization()

    assert dataset.class_labels is None
    assert dataset.summaries == ["Summary one.", "Summary two."]

  def test_class_labels_extracts_labels_when_present(self):
    dataset = DatasetMother.classification()

    assert dataset.class_labels == ["sports", "tech"]
    assert dataset.summaries is None
    assert dataset.documents == ["Sports news.", "Tech article."]

  def test_len_returns_sample_count(self):
    dataset = DatasetMother.summarization()
    assert len(dataset) == 2

class TestDatasetLoader:
  def setup_method(self):
    self.mock_s3 = MagicMock()
    patcher = patch("dataset_loader.boto3.client", return_value=self.mock_s3)
    patcher.start()
    self.addCleanup = patcher.stop
    self.loader = DatasetLoader(bucket_name="test-bucket")

  def teardown_method(self):
    self.addCleanup()

  def test_raises_when_bucket_not_configured(self, monkeypatch):
    monkeypatch.delenv("DATASET_BUCKET", raising=False)

    with pytest.raises(ValueError, match="DATASET_BUCKET"):
      DatasetLoader(bucket_name=None)

  def test_load_dataset_parses_csv_from_s3(self):
    csv_content = "document,summary\nHello world,Short summary\n"
    self.mock_s3.get_object.return_value = {
      "Body": BytesIO(csv_content.encode("utf-8")),
    }

    dataset = self.loader.load_dataset("dataset-1")

    assert len(dataset) == 1
    assert dataset.documents == ["Hello world"]
    assert dataset.summaries == ["Short summary"]
    assert dataset.class_labels is None

  def test_load_dataset_parses_jsonl_from_s3_when_csv_missing(self):
    def get_object_side_effect(Bucket, Key):
      if Key.endswith(".csv"):
        error = ClientError(
          {"Error": {"Code": "NoSuchKey", "Message": "not found"}},
          "GetObject",
        )
        raise error
      return {
        "Body": BytesIO(b'{"document":"Doc","summary":"Sum"}\n'),
      }

    self.mock_s3.get_object.side_effect = get_object_side_effect

    dataset = self.loader.load_dataset("dataset-2")

    assert len(dataset) == 1
    assert dataset.summaries == ["Sum"]

  def test_raises_when_dataset_not_found(self):
    error = ClientError(
      {"Error": {"Code": "NoSuchKey", "Message": "not found"}},
      "GetObject",
    )
    self.mock_s3.get_object.side_effect = error

    with pytest.raises(ValueError, match="Dataset not found"):
      self.loader.load_dataset("missing")

  def test_parse_csv_requires_document_column(self):
    with pytest.raises(ValueError, match="document"):
      self.loader._parse_csv("summary\nvalue\n")

  def test_parse_csv_skips_empty_documents(self):
    samples = self.loader._parse_csv(
      "document,summary\n,empty\nValid doc,summary\n"
    )

    assert len(samples) == 1
    assert samples[0]["document"] == "Valid doc"

  def test_parse_jsonl_raises_on_invalid_json(self):
    with pytest.raises(ValueError, match="invalid JSON"):
      self.loader._parse_jsonl('{"document":"ok"}\n{bad json}\n')

  def test_parse_jsonl_requires_document_field(self):
    with pytest.raises(ValueError, match="missing required 'document'"):
      self.loader._parse_jsonl(json.dumps({"summary": "only summary"}) + "\n")
