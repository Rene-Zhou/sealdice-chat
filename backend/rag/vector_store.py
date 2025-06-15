import chromadb
from langchain_community.embeddings import DashScopeEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from typing import List, Dict
from config import config
from processors.data_processor import ProcessedDocument

class FiveToolsVectorStore:
    def __init__(self, persist_directory: str = "./chroma_db"):
        # 使用阿里云text-embedding-v4
        self.embeddings = DashScopeEmbeddings(
            model=config.EMBEDDING_MODEL,
            dashscope_api_key=config.DASHSCOPE_API_KEY,
            dimension=config.EMBEDDING_DIMENSION,  # 使用1024维度平衡性能和效果
            output_type="dense"  # 使用稠密向量
        )
        
        # 初始化ChromaDB
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection_name = "5etools_knowledge_v4"
        
        # 文本分割器 - 针对8192 Token优化
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,  # 适配8192 Token限制
            chunk_overlap=200,
            length_function=len,
        )
        
    def build_index(self, documents: List[ProcessedDocument]) -> bool:
        """构建向量索引"""
        try:
            # 重建集合
            try:
                self.client.delete_collection(self.collection_name)
            except:
                pass
            
            collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            
            # 批量处理 - 遵循API限制（每批最多10条）
            batch_size = 8  # 保守设置，确保稳定性
            total_chunks = 0
            
            for i in range(0, len(documents), batch_size):
                batch_docs = documents[i:i+batch_size]
                
                # 准备批量数据
                texts = []
                metadatas = []
                ids = []
                
                for doc in batch_docs:
                    # 分割长文档
                    chunks = self.text_splitter.split_text(doc.content)
                    
                    for j, chunk in enumerate(chunks):
                        chunk_id = f"{doc.id}_chunk_{j}"
                        texts.append(chunk)
                        metadatas.append({
                            'document_id': doc.id,
                            'title': doc.title,
                            'category': doc.category,
                            'chunk_index': j,
                            **doc.metadata
                        })
                        ids.append(chunk_id)
                
                if texts:
                    # 使用text-embedding-v4批量嵌入
                    embeddings = self.embeddings.embed_documents(texts)
                    
                    collection.add(
                        embeddings=embeddings,
                        documents=texts,
                        metadatas=metadatas,
                        ids=ids
                    )
                    
                    total_chunks += len(texts)
                    print(f"✅ 已处理 {i+len(batch_docs)}/{len(documents)} 个文档，共 {total_chunks} 个向量块")
            
            print(f"🎉 向量索引构建完成！共生成 {total_chunks} 个向量块")
            return True
            
        except Exception as e:
            print(f"❌ 向量索引构建失败: {e}")
            return False
    
    def search(self, query: str, category_filter: str = None, n_results: int = 5) -> List[Dict]:
        """语义搜索"""
        try:
            collection = self.client.get_collection(self.collection_name)
            
            # 使用text-embedding-v4进行查询嵌入
            query_embedding = self.embeddings.embed_query(query)
            
            # 构建过滤条件
            where_filter = {}
            if category_filter:
                where_filter["category"] = category_filter
            
            # 执行向量搜索
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter if where_filter else None,
                include=["documents", "metadatas", "distances"]
            )
            
            # 格式化结果
            formatted_results = []
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'content': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'score': 1 - results['distances'][0][i]  # 转换为相似度分数
                })
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ 搜索失败: {e}")
            return [] 