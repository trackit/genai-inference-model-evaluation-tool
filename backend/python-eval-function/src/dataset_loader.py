import logging
import os
import csv
import json
from typing import Dict, List, Any, Optional
import boto3
from botocore.exceptions import ClientError
from io import StringIO

logger = logging.getLogger(__name__)


class Dataset:
    """Represents a parsed dataset with documents and optional reference outputs."""
    
    def __init__(self, samples: List[Dict[str, str]]):
        self.samples = samples
    
    @property
    def documents(self) -> List[str]:
        """Extract all document texts from the dataset."""
        return [sample['document'] for sample in self.samples]
    
    @property
    def summaries(self) -> Optional[List[str]]:
        """Extract all summaries if present, otherwise None."""
        if not self.samples or 'summary' not in self.samples[0]:
            return None
        return [sample.get('summary', '') for sample in self.samples]
    
    @property
    def class_labels(self) -> Optional[List[str]]:
        """Extract all class labels if present, otherwise None."""
        if not self.samples or 'class_label' not in self.samples[0]:
            return None
        return [sample.get('class_label', '') for sample in self.samples]
    
    def __len__(self) -> int:
        return len(self.samples)


class DatasetLoader:
    """Loads and parses datasets from S3."""
    
    def __init__(self, bucket_name: Optional[str] = None):
        self.bucket_name = bucket_name or os.environ.get('DATASET_BUCKET')
        if not self.bucket_name:
            raise ValueError("DATASET_BUCKET environment variable is required")
        
        self.s3_client = boto3.client('s3')
        
    def load_dataset(self, dataset_id: str) -> Dataset:
        try:
            logger.info(f"Loading dataset: {dataset_id}")
            
            content, file_format = self._load_from_s3(dataset_id)
            
            if file_format == 'csv':
                samples = self._parse_csv(content)
            elif file_format == 'jsonl':
                samples = self._parse_jsonl(content)
            else:
                raise ValueError(f"Unsupported dataset format: {file_format}")
            
            dataset = Dataset(samples)
            logger.info(f"Loaded dataset with {len(dataset)} samples")
            
            return dataset
            
        except ClientError as e:
            logger.error(f"S3 error loading dataset {dataset_id}: {e}")
            raise
        except Exception as e:
            logger.error(f"Error loading dataset {dataset_id}: {e}")
            raise
    
    def _load_from_s3(self, dataset_id: str) -> tuple[str, str]:
        
        for extension, file_format in [('.csv', 'csv'), ('.jsonl', 'jsonl')]:
            s3_key = f"datasets/{dataset_id}{extension}"
            try:
                response = self.s3_client.get_object(Bucket=self.bucket_name, Key=s3_key)
                content = response['Body'].read().decode('utf-8')
                logger.info(f"Successfully loaded {file_format} file from S3")
                return content, file_format
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchKey':
                    continue
                raise
        
        raise ValueError(f"Dataset not found in S3: {dataset_id} (tried .csv and .jsonl)")
    
    def _parse_csv(self, content: str) -> List[Dict[str, str]]:
        try:
            reader = csv.DictReader(StringIO(content))
            
            if 'document' not in reader.fieldnames:
                raise ValueError("CSV must contain 'document' column")
            
            samples = []
            for row_num, row in enumerate(reader, start=2):
                if not row.get('document'):
                    logger.warning(f"Row {row_num} has empty document field, skipping")
                    continue
                
                sample = {'document': row['document']}
                
                if 'summary' in row and row['summary']:
                    sample['summary'] = row['summary']
                
                if 'class' in row and row['class']:
                    sample['class_label'] = row['class']
                
                samples.append(sample)
            
            if not samples:
                raise ValueError("CSV contains no valid samples")
            
            logger.info(f"Parsed {len(samples)} samples from CSV")
            return samples
            
        except csv.Error as e:
            raise ValueError(f"CSV parsing error: {e}")
    
    def _parse_jsonl(self, content: str) -> List[Dict[str, str]]:
        samples = []
        lines = content.strip().split('\n')
        
        for line_num, line in enumerate(lines, start=1):
            if not line.strip():
                continue
            
            try:
                obj = json.loads(line)
                
                if 'document' not in obj:
                    raise ValueError(f"Line {line_num}: missing required 'document' field")
                
                if not obj['document']:
                    logger.warning(f"Line {line_num} has empty document field, skipping")
                    continue
                
                sample = {'document': obj['document']}
                
                if 'summary' in obj and obj['summary']:
                    sample['summary'] = obj['summary']
                
                if 'class' in obj and obj['class']:
                    sample['class_label'] = obj['class']
                
                samples.append(sample)
                
            except json.JSONDecodeError as e:
                raise ValueError(f"Line {line_num}: invalid JSON - {e}")
        
        if not samples:
            raise ValueError("JSONL contains no valid samples")
        
        logger.info(f"Parsed {len(samples)} samples from JSONL")
        return samples
